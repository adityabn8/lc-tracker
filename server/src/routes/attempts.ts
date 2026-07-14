import { Router, Request, Response } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { applyPass, applyFail } from "../domain/schedule";

const router = Router({ mergeParams: true });
router.use(requireAuth);

// ---------------------------------------------------------------------------
// POST /api/problems/:trackedId/attempts — log a pass or fail
// ---------------------------------------------------------------------------
router.post("/", async (req: Request, res: Response) => {
  const schema = z.discriminatedUnion("outcome", [
    z.object({ outcome: z.literal("PASS") }),
    z.object({
      outcome: z.literal("FAIL"),
      failureNote: z
        .string()
        .min(10, "Failure note must be at least 10 characters")
        .refine((s) => s.trim().length >= 10, "Failure note must not be whitespace"),
    }),
  ]);

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const userId = req.session.userId!;
  const tz = req.session.userTimezone!;
  const today = DateTime.now().setZone(tz).toISODate()!;
  const { trackedId } = req.params;

  const tracked = await prisma.trackedProblem.findFirst({
    where: { id: trackedId, userId },
  });

  if (!tracked) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (tracked.status === "MASTERED") {
    res.status(400).json({ error: "Problem is already mastered" });
    return;
  }

  const attemptStage = tracked.currentStage + 1;
  const { outcome } = parsed.data;

  // Compute next state
  const currentState = {
    currentStage: tracked.currentStage,
    nextDueDate: tracked.nextDueDate?.toISOString().split("T")[0] ?? null,
    status: tracked.status as "ACTIVE" | "MASTERED",
    resetCount: tracked.resetCount,
  };

  const nextState =
    outcome === "PASS"
      ? applyPass(currentState, today)
      : applyFail(currentState, today);

  // Write attempt + update tracked problem in a transaction
  const [attempt] = await prisma.$transaction([
    prisma.attempt.create({
      data: {
        trackedProblemId: trackedId,
        stage: attemptStage,
        attemptedAt: new Date(today),
        outcome,
        failureNote: outcome === "FAIL" ? (parsed.data as { failureNote: string }).failureNote : null,
      },
    }),
    prisma.trackedProblem.update({
      where: { id: trackedId },
      data: {
        currentStage: nextState.currentStage,
        nextDueDate: nextState.nextDueDate ? new Date(nextState.nextDueDate) : null,
        status: nextState.status,
        resetCount: nextState.resetCount,
      },
    }),
  ]);

  res.status(201).json({
    attempt: {
      id: attempt.id,
      stage: attempt.stage,
      attemptedAt: today,
      outcome: attempt.outcome,
      failureNote: attempt.failureNote,
      createdAt: attempt.createdAt,
    },
    trackedProblem: {
      currentStage: nextState.currentStage,
      nextDueDate: nextState.nextDueDate,
      status: nextState.status,
      resetCount: nextState.resetCount,
    },
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/problems/:trackedId/attempts/:attemptId — undo (session-level)
// ---------------------------------------------------------------------------
router.delete("/:attemptId", async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { trackedId, attemptId } = req.params;

  const tracked = await prisma.trackedProblem.findFirst({
    where: { id: trackedId, userId },
    include: {
      attempts: { orderBy: { createdAt: "desc" }, take: 2 },
    },
  });

  if (!tracked) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const attempt = tracked.attempts.find((a) => a.id === attemptId);
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }

  // Only allow undo of the most recent attempt
  if (tracked.attempts[0]?.id !== attemptId) {
    res.status(400).json({ error: "Can only undo the most recent attempt" });
    return;
  }

  // Restore prior state by replaying all but the last attempt
  const allAttempts = await prisma.attempt.findMany({
    where: { trackedProblemId: trackedId, id: { not: attemptId } },
    orderBy: { createdAt: "asc" },
  });

  const initialDate = tracked.initialSolvedAt.toISOString().split("T")[0];
  let state = {
    currentStage: 0,
    nextDueDate: null as string | null,
    status: "ACTIVE" as "ACTIVE" | "MASTERED",
    resetCount: 0,
  };

  // Recompute state from scratch using domain functions
  const { computeInitialState: init, applyPass: pass, applyFail: fail } = await import("../domain/schedule");
  state = init(initialDate);

  for (const a of allAttempts) {
    const date = a.attemptedAt.toISOString().split("T")[0];
    state = a.outcome === "PASS" ? pass(state, date) : fail(state, date);
  }

  await prisma.$transaction([
    prisma.attempt.delete({ where: { id: attemptId } }),
    prisma.trackedProblem.update({
      where: { id: trackedId },
      data: {
        currentStage: state.currentStage,
        nextDueDate: state.nextDueDate ? new Date(state.nextDueDate) : null,
        status: state.status,
        resetCount: state.resetCount,
      },
    }),
  ]);

  res.json({
    ok: true,
    trackedProblem: {
      currentStage: state.currentStage,
      nextDueDate: state.nextDueDate,
      status: state.status,
      resetCount: state.resetCount,
    },
  });
});

export default router;
