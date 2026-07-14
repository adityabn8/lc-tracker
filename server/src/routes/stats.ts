import { Router, Request, Response } from "express";
import { DateTime } from "luxon";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const tz = req.session.userTimezone!;
  const today = DateTime.now().setZone(tz);
  const in7 = today.plus({ days: 7 }).toISODate()!;
  const in30 = today.plus({ days: 30 }).toISODate()!;

  const [
    totalTracked,
    totalMastered,
    attempts,
    totalResets,
    weakSpots,
    byDifficulty,
    upcoming7,
    upcoming30,
  ] = await Promise.all([
    prisma.trackedProblem.count({ where: { userId } }),
    prisma.trackedProblem.count({ where: { userId, status: "MASTERED" } }),
    prisma.attempt.findMany({
      where: { trackedProblem: { userId } },
      select: { outcome: true },
    }),
    prisma.trackedProblem.aggregate({
      where: { userId },
      _sum: { resetCount: true },
    }),
    prisma.trackedProblem.findMany({
      where: { userId, resetCount: { gt: 0 } },
      orderBy: { resetCount: "desc" },
      take: 10,
      include: { problem: { select: { id: true, title: true, difficulty: true } } },
    }),
    prisma.trackedProblem.groupBy({
      by: ["problemId"],
      where: { userId },
      _count: true,
    }),
    prisma.trackedProblem.count({
      where: { userId, status: "ACTIVE", nextDueDate: { lte: new Date(in7) } },
    }),
    prisma.trackedProblem.count({
      where: { userId, status: "ACTIVE", nextDueDate: { lte: new Date(in30) } },
    }),
  ]);

  const totalAttempts = attempts.length;
  const passAttempts = attempts.filter((a) => a.outcome === "PASS").length;
  const retentionRate = totalAttempts > 0 ? passAttempts / totalAttempts : null;

  // Difficulty breakdown
  const trackedAll = await prisma.trackedProblem.findMany({
    where: { userId },
    include: { problem: { select: { difficulty: true, tags: true } } },
  });

  const difficultyBreakdown = { EASY: 0, MEDIUM: 0, HARD: 0 };
  const tagCount: Record<string, number> = {};

  for (const tp of trackedAll) {
    difficultyBreakdown[tp.problem.difficulty]++;
    for (const tag of tp.problem.tags) {
      tagCount[tag] = (tagCount[tag] ?? 0) + 1;
    }
  }

  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  res.json({
    totalTracked,
    totalActive: totalTracked - totalMastered,
    totalMastered,
    totalAttempts,
    passAttempts,
    retentionRate,
    totalResets: totalResets._sum.resetCount ?? 0,
    weakSpots: weakSpots.map((w) => ({
      id: w.id,
      resetCount: w.resetCount,
      problem: w.problem,
    })),
    difficultyBreakdown,
    topTags,
    upcoming: { next7: upcoming7, next30: upcoming30 },
  });
});

export default router;
