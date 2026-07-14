# SPEC.md — LeetCode Re-Solve Tracker (MVP)

> Hand this file to Claude Code as the source of truth. Build only what is in scope.
> Do not add features outside Section 3. Ask before deviating from the domain rules in Section 4.

---

## 1. One-line summary

A mobile-first, desktop-responsive web app that schedules spaced re-solves of LeetCode problems, records pass/fail outcomes with failure notes, and resets a problem's progress whenever a scheduled re-solve is failed.

## 2. Why

Solving a LeetCode problem once does not create retention. LeetCode has no mechanism to schedule re-solves or detect decay. This app enforces a fixed spaced-repetition cycle and makes weak spots visible.

## 3. Scope

**In scope (build this):**
- Email/password auth, multi-user
- Manual problem entry by LeetCode problem number
- Fixed 4-stage spaced-repetition scheduling
- Reset-on-failure
- Pass/Fail logging with mandatory failure note on Fail
- Today's due queue (home screen)
- Full problem list with filters + search
- Per-problem detail with full attempt history
- Stats dashboard

**Out of scope (do NOT build):**
- LeetCode account sync or submission scraping
- Storing user code / solutions
- Notifications, email, push
- Social features, sharing, leaderboards
- GenAI features of any kind
- Native mobile apps
- Configurable/custom intervals (schedule is fixed for MVP)

---

## 4. Domain rules (the core of the app — get these exactly right)

### 4.1 The resolve plan

Four stages. Each interval is measured **from the date of the most recent successful attempt** (or from the initial solve, for Stage 1).

| Stage | Due | Interval |
|-------|-----|----------|
| 1 | initial_solved_at + 3 days | 3d |
| 2 | stage-1 pass date + 10 days | 10d |
| 3 | stage-2 pass date + 30 days | 30d |
| 4 | stage-3 pass date + 90 days | 90d |

- Adding a problem records an **initial solve** (Day 0). It does **not** create an attempt row. It sets `current_stage = 0` and `next_due_date = initial_solved_at + 3 days`.
- A **PASS** at stage *n* advances `current_stage` to *n*, and sets `next_due_date` per the table for stage *n+1*.
- A **PASS at stage 4** sets `status = MASTERED`, `current_stage = 4`, `next_due_date = NULL`. Nothing further is scheduled.
- Intervals are **fixed day counts** (30 and 90 days, not calendar months). Simple date arithmetic.

### 4.2 Reset rule (critical)

A **FAIL at any stage** resets the problem to the beginning of the plan:
- `current_stage = 0`
- `next_due_date = fail_date + 3 days`
- `reset_count += 1`
- `status` stays `ACTIVE`

The attempt history is **never deleted**. A reset only moves the stage pointer. Prior attempts (including passes at higher stages) remain in the log permanently.

### 4.3 Overdue

- A due item stays in the queue until the user actions it. Overdue does **not** auto-fail.
- Due dates are **dates**, not timestamps, evaluated in the **user's timezone** (stored on the user record). Do not compare against server UTC.
- "Due today" means `next_due_date <= today_in_user_tz`.

### 4.4 Idempotency

Logging an attempt must not double-advance the stage on a duplicate/retried request. Guard against double-taps on mobile.

---

## 5. Data model

```
users
  id              uuid pk
  email           text unique not null
  password_hash   text not null
  timezone        text not null   -- IANA, e.g. "Asia/Kolkata"
  created_at      timestamptz

problems                          -- global, read-only, seeded catalog
  id              int pk          -- LeetCode problem number
  title           text not null
  slug            text not null
  difficulty      enum(EASY, MEDIUM, HARD) not null
  tags            text[]          -- canonical LeetCode topic tags
  url             text not null

tracked_problems                  -- a user's plan state for one problem
  id                 uuid pk
  user_id            uuid fk -> users
  problem_id         int  fk -> problems
  initial_solved_at  date not null
  current_stage      int  not null default 0   -- 0..4
  next_due_date      date null                 -- NULL iff MASTERED
  status             enum(ACTIVE, MASTERED) not null default ACTIVE
  reset_count        int  not null default 0
  created_at         timestamptz
  UNIQUE (user_id, problem_id)

attempts                          -- append-only log, never updated or deleted
  id                    uuid pk
  tracked_problem_id    uuid fk -> tracked_problems
  stage                 int  not null      -- 1..4, the stage being attempted
  attempted_at          date not null
  outcome               enum(PASS, FAIL) not null
  failure_note          text null          -- REQUIRED when outcome = FAIL
  created_at            timestamptz
```

Constraint: `attempts.failure_note` must be non-empty when `outcome = FAIL`. Enforce at DB level and in the API.

---

## 6. The problem catalog (important)

**LeetCode has no official public API. Do not call LeetCode at runtime.**

Seed the `problems` table once from a static dataset:
- Source the catalog from LeetCode's public GraphQL endpoint (`https://leetcode.com/graphql`, `problemsetQuestionList` query) via a **one-off seed script** run at build/deploy time, OR from a checked-in JSON file.
- Fields needed: `questionFrontendId` (→ `id`), `title`, `titleSlug`, `difficulty`, `topicTags[].slug` (→ `tags`).
- The running app must function fully with zero network calls to LeetCode. The seed is a maintenance task, never a request-path dependency.
- **Do not infer tags with an LLM.** Tags must be LeetCode's canonical taxonomy, or filtering breaks.

Ship the seed script as `scripts/seed-problems.ts` (or equivalent) plus a committed `data/problems.json` fallback so the app is installable offline.

---

## 7. Functional requirements

### FR-1 — Auth
- Signup (email, password, timezone), login, logout. Persisted session.
- Timezone captured at signup (default from browser, user-editable in settings).
- All queries scoped to the authenticated user. No cross-user data access.

### FR-2 — Add problem
- Single input: LeetCode problem number.
- Look up in `problems`. Show a **confirmation preview** (number, title, difficulty, tags) before saving.
- Reject unknown numbers with a clear message.
- Reject duplicates; offer a link to the existing tracked problem.
- Optional field: **initial solve date**, defaulting to today, to allow backfilling already-solved problems.
- On save: create `tracked_problem` with `current_stage = 0`, `next_due_date = initial_solved_at + 3d`, `status = ACTIVE`.

### FR-3 — Due queue (home screen)
- Lists `tracked_problems` where `status = ACTIVE` AND `next_due_date <= today (user tz)`.
- Sort: most overdue first, then by due date.
- Each row shows: problem number, title, difficulty, tags, current stage (e.g. "Stage 2 of 4"), and days overdue if > 0.
- Row actions: **Open on LeetCode** (new tab), **Pass**, **Fail**.
- Empty state when nothing is due, showing the next upcoming due date.

### FR-4 — Log attempt
- **Pass**: one tap. Writes `attempt(stage = current_stage + 1, outcome = PASS)`. Advances stage. Recomputes `next_due_date`. Sets `MASTERED` if the passed stage was 4.
- **Fail**: opens a note input. The **failure note is mandatory** (reject empty/whitespace; enforce a sensible min length, e.g. 10 chars). Writes `attempt(outcome = FAIL, failure_note)`. Applies the reset rule (4.2).
- Both actions support **single-level undo within the session** (guards against mis-taps on mobile). Undo deletes the attempt row and restores the prior `tracked_problem` state.

### FR-5 — Problem list
- All tracked problems for the user.
- Filters: difficulty, tag, status (ACTIVE / MASTERED), current stage.
- Sort: next due date, date added, reset count, difficulty.
- Search: by problem number or title substring.

### FR-6 — Problem detail
- Catalog metadata + external link to LeetCode.
- Current stage, next due date, reset count, status.
- **Full attempt history**, chronological: stage, date, outcome, failure note. Resets visible as a break in the sequence.
- Remove-from-tracking action, with confirmation.

### FR-7 — Stats dashboard
- Totals: tracked, active, mastered.
- **Retention rate** = PASS attempts / total attempts.
- Total resets, and a **weak-spots list**: problems with the highest `reset_count`.
- Breakdown of tracked problems by difficulty and by tag.
- **Upcoming load**: count of problems due in the next 7 and 30 days.

---

## 8. Non-functional requirements

- **Mobile-first.** The primary loop — open app → see due queue → mark pass/fail — must be completable one-handed on a phone. Touch targets ≥ 44px. Desktop is a responsive expansion (multi-column), not a separate design.
- **Timezone-correct.** All due-date logic in the user's stored IANA timezone.
- **Append-only history.** Attempts are never updated or deleted (except by the session-level undo, which is a true delete of a just-created row).
- **No runtime LeetCode dependency.**
- **Fast home screen.** The due queue is the hot path; index `(user_id, status, next_due_date)`.

---

## 9. Suggested implementation notes (Claude Code may choose otherwise, but justify)

- Put **all scheduling logic in one pure module** (e.g. `src/domain/schedule.ts`) with no I/O: `computeNextDue(stage, fromDate)`, `applyPass(trackedProblem, date)`, `applyFail(trackedProblem, date)`. This is the heart of the app and must be unit-tested exhaustively.
- **Required tests** for the domain module:
  - Full happy path: add → pass S1 → pass S2 → pass S3 → pass S4 → MASTERED, asserting each `next_due_date`.
  - Fail at each of stages 1, 2, 3, 4 → asserts stage resets to 0, due = fail + 3d, reset_count increments, history preserved.
  - Fail after a reset (reset_count = 2).
  - Overdue item does not auto-fail and remains in the queue.
  - Timezone boundary: an item due "today" in Asia/Kolkata is not treated as due-tomorrow by a UTC server.
  - Idempotency: replaying the same pass does not double-advance.
- Keep the API thin; the domain module owns all state transitions.

---

## 10. Open questions (answer before or during build)

1. Should a MASTERED problem be re-addable, to voluntarily restart the cycle? *(Recommend: yes, as a "restart" action on the detail page.)*
2. Should the failure note be structured (dropdown: forgot pattern / missed edge case / TLE / couldn't recall syntax) instead of free text, for better weak-spot analytics? *(Recommend: free text for MVP, structured later.)*
3. Is a binary pass/fail losing signal — e.g. "solved but needed a hint" or "solved but slowly"? *(Recommend: keep binary for MVP; a third state complicates the reset rule.)*

---

## 11. Definition of done

- A user can sign up, add a problem by number, and see it appear with the correct Stage 1 due date 3 days out.
- On the due date, the problem appears in the due queue.
- Marking Pass advances the stage and schedules the next interval correctly.
- Marking Fail requires a note, resets the problem to a 3-day due date, increments the reset count, and preserves all prior history on the detail page.
- Passing stage 4 marks the problem MASTERED and removes it from scheduling.
- All of the above works one-handed on a 375px-wide viewport.
- The domain module has full unit test coverage of the scenarios in Section 9.
