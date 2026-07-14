import { Router, Request, Response } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import {
  computeInitialState,
  applyPass,
  applyFail,
  isDueToday,
  daysOverdue,
} from "../domain/schedule";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// POST /api/problems — add a problem to tracking (manual entry)
// The user supplies the LeetCode number, title, and difficulty themselves;
// the problem row is created/updated on the fly — no pre-seeded catalog.
// ---------------------------------------------------------------------------
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

router.post("/", async (req: Request, res: Response) => {
  const schema = z.object({
    problemId: z.number().int().positive(),
    title: z.string().trim().min(1).max(200),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
    initialSolvedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const userId = req.session.userId!;
  const { problemId, title, difficulty } = parsed.data;
  const tags = parsed.data.tags ?? [];
  const initialSolvedAt = parsed.data.initialSolvedAt ?? DateTime.now().toISODate()!;

  const existing = await prisma.trackedProblem.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });
  if (existing) {
    res.status(409).json({ error: "Already tracking this problem", trackedProblemId: existing.id });
    return;
  }

  const slug = slugify(title);
  const url = `https://leetcode.com/problems/${slug}/`;
  await prisma.problem.upsert({
    where: { id: problemId },
    update: { title, slug, difficulty, tags, url },
    create: { id: problemId, title, slug, difficulty, tags, url },
  });

  const state = computeInitialState(initialSolvedAt);

  const tracked = await prisma.trackedProblem.create({
    data: {
      userId,
      problemId,
      initialSolvedAt: new Date(initialSolvedAt),
      currentStage: state.currentStage,
      nextDueDate: state.nextDueDate ? new Date(state.nextDueDate) : null,
      status: state.status,
      resetCount: state.resetCount,
    },
    include: { problem: true },
  });

  res.status(201).json(serializeTracked(tracked, req.session.userTimezone!));
});

// ---------------------------------------------------------------------------
// GET /api/problems/due — today's due queue
// ---------------------------------------------------------------------------
router.get("/due", async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const tz = req.session.userTimezone!;
  const todayInTz = DateTime.now().setZone(tz).toISODate()!;

  const items = await prisma.trackedProblem.findMany({
    where: {
      userId,
      status: "ACTIVE",
      nextDueDate: { lte: new Date(todayInTz) },
    },
    include: { problem: true },
    orderBy: { nextDueDate: "asc" },
  });

  res.json(items.map((item) => serializeTracked(item, tz)));
});

// ---------------------------------------------------------------------------
// GET /api/problems/upcoming — count due in next 7 and 30 days
// ---------------------------------------------------------------------------
router.get("/upcoming", async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const tz = req.session.userTimezone!;
  const today = DateTime.now().setZone(tz);

  const in7 = today.plus({ days: 7 }).toISODate()!;
  const in30 = today.plus({ days: 30 }).toISODate()!;

  const [next7, next30] = await Promise.all([
    prisma.trackedProblem.count({
      where: { userId, status: "ACTIVE", nextDueDate: { lte: new Date(in7) } },
    }),
    prisma.trackedProblem.count({
      where: { userId, status: "ACTIVE", nextDueDate: { lte: new Date(in30) } },
    }),
  ]);

  res.json({ next7, next30 });
});

// ---------------------------------------------------------------------------
// GET /api/problems — full problem list with filters
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const tz = req.session.userTimezone!;

  const {
    difficulty,
    tag,
    status,
    stage,
    search,
    sort = "nextDueDate",
  } = req.query as Record<string, string>;

  const items = await prisma.trackedProblem.findMany({
    where: {
      userId,
      ...(status ? { status: status as "ACTIVE" | "MASTERED" } : {}),
      ...(stage !== undefined ? { currentStage: parseInt(stage, 10) } : {}),
      problem: {
        ...(difficulty ? { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { id: isNaN(parseInt(search, 10)) ? undefined : parseInt(search, 10) },
              ],
            }
          : {}),
      },
    },
    include: { problem: true },
    orderBy:
      sort === "resetCount"
        ? { resetCount: "desc" }
        : sort === "difficulty"
        ? { problem: { difficulty: "asc" } }
        : sort === "createdAt"
        ? { createdAt: "desc" }
        : { nextDueDate: "asc" },
  });

  res.json(items.map((item) => serializeTracked(item, tz)));
});

// ---------------------------------------------------------------------------
// GET /api/problems/:trackedId — problem detail
// ---------------------------------------------------------------------------
router.get("/:trackedId", async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const tz = req.session.userTimezone!;

  const tracked = await prisma.trackedProblem.findFirst({
    where: { id: req.params.trackedId, userId },
    include: {
      problem: true,
      attempts: { orderBy: { attemptedAt: "asc" } },
    },
  });

  if (!tracked) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({
    ...serializeTracked(tracked, tz),
    attempts: tracked.attempts.map((a) => ({
      id: a.id,
      stage: a.stage,
      attemptedAt: toISODate(a.attemptedAt),
      outcome: a.outcome,
      failureNote: a.failureNote,
      createdAt: a.createdAt,
    })),
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/problems/:trackedId — remove from tracking
// ---------------------------------------------------------------------------
router.delete("/:trackedId", async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  const tracked = await prisma.trackedProblem.findFirst({
    where: { id: req.params.trackedId, userId },
  });
  if (!tracked) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await prisma.trackedProblem.delete({ where: { id: tracked.id } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/problems/:trackedId/restart — restart a MASTERED problem
// ---------------------------------------------------------------------------
router.post("/:trackedId/restart", async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const tz = req.session.userTimezone!;
  const today = DateTime.now().setZone(tz).toISODate()!;

  const tracked = await prisma.trackedProblem.findFirst({
    where: { id: req.params.trackedId, userId },
    include: { problem: true },
  });

  if (!tracked) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (tracked.status !== "MASTERED") {
    res.status(400).json({ error: "Problem is not mastered" });
    return;
  }

  const state = computeInitialState(today);
  const updated = await prisma.trackedProblem.update({
    where: { id: tracked.id },
    data: {
      currentStage: state.currentStage,
      nextDueDate: state.nextDueDate ? new Date(state.nextDueDate) : null,
      status: state.status,
      initialSolvedAt: new Date(today),
    },
    include: { problem: true },
  });

  res.json(serializeTracked(updated, tz));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toISODate(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().split("T")[0];
}

function serializeTracked(
  tracked: {
    id: string;
    problemId: number;
    initialSolvedAt: Date;
    currentStage: number;
    nextDueDate: Date | null;
    status: string;
    resetCount: number;
    createdAt: Date;
    problem: {
      id: number;
      title: string;
      slug: string;
      difficulty: string;
      tags: string[];
      url: string;
    };
  },
  tz: string
) {
  const nextDueDateISO = toISODate(tracked.nextDueDate);
  return {
    id: tracked.id,
    problemId: tracked.problemId,
    initialSolvedAt: toISODate(tracked.initialSolvedAt),
    currentStage: tracked.currentStage,
    nextDueDate: nextDueDateISO,
    status: tracked.status,
    resetCount: tracked.resetCount,
    createdAt: tracked.createdAt,
    daysOverdue:
      nextDueDateISO && isDueToday(nextDueDateISO, tz)
        ? daysOverdue(nextDueDateISO, tz)
        : null,
    problem: tracked.problem,
  };
}

export default router;
