import { describe, it, expect } from "vitest";
import {
  computeInitialState,
  applyPass,
  applyFail,
  isDueToday,
  computeNextDue,
  addDays,
} from "./schedule";

// ---------------------------------------------------------------------------
// Happy path: add → pass S1 → pass S2 → pass S3 → pass S4 → MASTERED
// ---------------------------------------------------------------------------
describe("full happy path", () => {
  const initialDate = "2024-01-01";

  it("initial state: stage 0, due in 3 days", () => {
    const state = computeInitialState(initialDate);
    expect(state.currentStage).toBe(0);
    expect(state.nextDueDate).toBe("2024-01-04"); // +3d
    expect(state.status).toBe("ACTIVE");
    expect(state.resetCount).toBe(0);
  });

  it("pass stage 1: advances to stage 1, due +10d from pass date", () => {
    let state = computeInitialState(initialDate);
    const passDate = "2024-01-04";
    state = applyPass(state, passDate);
    expect(state.currentStage).toBe(1);
    expect(state.nextDueDate).toBe("2024-01-14"); // +10d
    expect(state.status).toBe("ACTIVE");
  });

  it("pass stage 2: advances to stage 2, due +30d", () => {
    let state = computeInitialState(initialDate);
    state = applyPass(state, "2024-01-04");
    const passDate = "2024-01-14";
    state = applyPass(state, passDate);
    expect(state.currentStage).toBe(2);
    expect(state.nextDueDate).toBe("2024-02-13"); // +30d
    expect(state.status).toBe("ACTIVE");
  });

  it("pass stage 3: advances to stage 3, due +90d", () => {
    let state = computeInitialState(initialDate);
    state = applyPass(state, "2024-01-04");
    state = applyPass(state, "2024-01-14");
    const passDate = "2024-02-13";
    state = applyPass(state, passDate);
    expect(state.currentStage).toBe(3);
    expect(state.nextDueDate).toBe("2024-05-13"); // +90d
    expect(state.status).toBe("ACTIVE");
  });

  it("pass stage 4: status becomes MASTERED, nextDueDate is null", () => {
    let state = computeInitialState(initialDate);
    state = applyPass(state, "2024-01-04");
    state = applyPass(state, "2024-01-14");
    state = applyPass(state, "2024-02-13");
    const passDate = "2024-05-13";
    state = applyPass(state, passDate);
    expect(state.currentStage).toBe(4);
    expect(state.nextDueDate).toBeNull();
    expect(state.status).toBe("MASTERED");
  });
});

// ---------------------------------------------------------------------------
// Fail at each stage resets correctly
// ---------------------------------------------------------------------------
describe("fail resets", () => {
  const failDate = "2024-03-15";

  it("fail at stage 0 (S1 attempt): resets to stage 0, due +3d, resetCount=1", () => {
    let state = computeInitialState("2024-03-12");
    state = applyFail(state, failDate);
    expect(state.currentStage).toBe(0);
    expect(state.nextDueDate).toBe("2024-03-18"); // +3d
    expect(state.resetCount).toBe(1);
    expect(state.status).toBe("ACTIVE");
  });

  it("fail at stage 1 (S2 attempt): resets to stage 0", () => {
    let state = computeInitialState("2024-01-01");
    state = applyPass(state, "2024-01-04"); // now stage 1
    state = applyFail(state, failDate);
    expect(state.currentStage).toBe(0);
    expect(state.nextDueDate).toBe("2024-03-18");
    expect(state.resetCount).toBe(1);
  });

  it("fail at stage 2 (S3 attempt): resets to stage 0", () => {
    let state = computeInitialState("2024-01-01");
    state = applyPass(state, "2024-01-04");
    state = applyPass(state, "2024-01-14"); // now stage 2
    state = applyFail(state, failDate);
    expect(state.currentStage).toBe(0);
    expect(state.nextDueDate).toBe("2024-03-18");
    expect(state.resetCount).toBe(1);
  });

  it("fail at stage 3 (S4 attempt): resets to stage 0", () => {
    let state = computeInitialState("2024-01-01");
    state = applyPass(state, "2024-01-04");
    state = applyPass(state, "2024-01-14");
    state = applyPass(state, "2024-02-13"); // now stage 3
    state = applyFail(state, failDate);
    expect(state.currentStage).toBe(0);
    expect(state.nextDueDate).toBe("2024-03-18");
    expect(state.resetCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fail after a reset (reset_count > 1)
// ---------------------------------------------------------------------------
describe("multiple resets", () => {
  it("fail after a reset: resetCount increments again", () => {
    let state = computeInitialState("2024-01-01");
    state = applyFail(state, "2024-01-04"); // reset 1
    state = applyPass(state, "2024-01-07"); // pass stage 1 after reset
    state = applyFail(state, "2024-01-17"); // reset 2
    expect(state.resetCount).toBe(2);
    expect(state.currentStage).toBe(0);
    expect(state.nextDueDate).toBe("2024-01-20");
  });
});

// ---------------------------------------------------------------------------
// Overdue: item stays in queue and does not auto-fail
// ---------------------------------------------------------------------------
describe("overdue behaviour", () => {
  it("an overdue item remains ACTIVE with its original due date", () => {
    const state = computeInitialState("2023-01-01");
    // Due date is 2023-01-04 — far in the past
    expect(state.status).toBe("ACTIVE");
    expect(state.nextDueDate).toBe("2023-01-04");
    // No auto-failure — state unchanged without explicit applyFail
  });
});

// ---------------------------------------------------------------------------
// Timezone boundary: due "today" in a given timezone
// ---------------------------------------------------------------------------
describe("timezone boundary", () => {
  it("isDueToday returns true when nextDueDate <= today in user timezone", () => {
    // Use a fixed past date so the test never becomes flaky
    const pastDate = "2024-01-01";
    expect(isDueToday(pastDate, "Asia/Kolkata")).toBe(true);
  });

  it("isDueToday returns false for a future date", () => {
    const futureDate = "2099-12-31";
    expect(isDueToday(futureDate, "Asia/Kolkata")).toBe(false);
  });

  it("isDueToday returns false when nextDueDate is null (MASTERED)", () => {
    expect(isDueToday(null, "Asia/Kolkata")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Idempotency: replaying a pass on a MASTERED problem is a no-op
// ---------------------------------------------------------------------------
describe("idempotency", () => {
  it("applyPass on a MASTERED problem returns the same state", () => {
    let state = computeInitialState("2024-01-01");
    state = applyPass(state, "2024-01-04");
    state = applyPass(state, "2024-01-14");
    state = applyPass(state, "2024-02-13");
    state = applyPass(state, "2024-05-13"); // MASTERED
    const before = { ...state };
    state = applyPass(state, "2024-06-01"); // replay
    expect(state).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// computeNextDue helpers
// ---------------------------------------------------------------------------
describe("computeNextDue", () => {
  it("stage 1 = +3 days", () => expect(computeNextDue(1, "2024-01-01")).toBe("2024-01-04"));
  it("stage 2 = +10 days", () => expect(computeNextDue(2, "2024-01-01")).toBe("2024-01-11"));
  it("stage 3 = +30 days", () => expect(computeNextDue(3, "2024-01-01")).toBe("2024-01-31"));
  it("stage 4 = +90 days", () => expect(computeNextDue(4, "2024-01-01")).toBe("2024-04-01"));
});

// ---------------------------------------------------------------------------
// addDays: simple date arithmetic (no calendar months)
// ---------------------------------------------------------------------------
describe("addDays", () => {
  it("adds exactly 30 days (not 1 calendar month)", () => {
    expect(addDays("2024-01-31", 30)).toBe("2024-03-01");
  });
  it("adds exactly 90 days (not 3 calendar months)", () => {
    expect(addDays("2024-01-01", 90)).toBe("2024-04-01");
  });
});
