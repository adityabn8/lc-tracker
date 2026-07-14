import { DateTime } from "luxon";

export type TrackStatus = "ACTIVE" | "MASTERED";

export interface TrackedProblemState {
  currentStage: number;
  nextDueDate: string | null; // ISO date "YYYY-MM-DD"
  status: TrackStatus;
  resetCount: number;
}

// Days to add after a successful pass at each stage (indexed 1–4)
const STAGE_INTERVALS: Record<number, number> = {
  1: 3,
  2: 10,
  3: 30,
  4: 90,
};

export function addDays(isoDate: string, days: number): string {
  return DateTime.fromISO(isoDate).plus({ days }).toISODate()!;
}

export function computeNextDue(stage: number, fromDate: string): string {
  const interval = STAGE_INTERVALS[stage];
  if (!interval) throw new Error(`Invalid stage: ${stage}`);
  return addDays(fromDate, interval);
}

/**
 * Called when a problem is first added.
 * initial_solved_at is Day 0; Stage 1 is due 3 days later.
 */
export function computeInitialState(initialSolvedAt: string): TrackedProblemState {
  return {
    currentStage: 0,
    nextDueDate: addDays(initialSolvedAt, 3),
    status: "ACTIVE",
    resetCount: 0,
  };
}

/**
 * Apply a PASS at the current stage.
 * stage being passed = currentStage + 1 (the attempt stage).
 */
export function applyPass(
  state: TrackedProblemState,
  passDate: string
): TrackedProblemState {
  const attemptStage = state.currentStage + 1;

  if (attemptStage > 4) {
    // Already mastered — idempotent no-op
    return state;
  }

  if (attemptStage === 4) {
    return {
      ...state,
      currentStage: 4,
      nextDueDate: null,
      status: "MASTERED",
    };
  }

  return {
    ...state,
    currentStage: attemptStage,
    nextDueDate: computeNextDue(attemptStage + 1, passDate),
    status: "ACTIVE",
  };
}

/**
 * Apply a FAIL at any stage.
 * Resets to stage 0, schedules Stage 1 in 3 days, increments reset_count.
 */
export function applyFail(
  state: TrackedProblemState,
  failDate: string
): TrackedProblemState {
  return {
    ...state,
    currentStage: 0,
    nextDueDate: addDays(failDate, 3),
    status: "ACTIVE",
    resetCount: state.resetCount + 1,
  };
}

/**
 * Returns true if a tracked problem is due on or before today in the user's timezone.
 */
export function isDueToday(nextDueDate: string | null, userTimezone: string): boolean {
  if (!nextDueDate) return false;
  const today = DateTime.now().setZone(userTimezone).toISODate()!;
  return nextDueDate <= today;
}

/**
 * Days overdue (positive) or days until due (negative). 0 = due today.
 */
export function daysOverdue(nextDueDate: string, userTimezone: string): number {
  const today = DateTime.now().setZone(userTimezone).toISODate()!;
  const due = DateTime.fromISO(nextDueDate);
  const now = DateTime.fromISO(today);
  return Math.round(now.diff(due, "days").days);
}
