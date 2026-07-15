-- Deleting a tracked problem must delete its attempt history with it.
-- The original FK was ON DELETE RESTRICT, which made DELETE /api/problems/:id
-- fail for any problem that had recorded attempts.
ALTER TABLE "attempts" DROP CONSTRAINT "attempts_tracked_problem_id_fkey";

ALTER TABLE "attempts" ADD CONSTRAINT "attempts_tracked_problem_id_fkey"
  FOREIGN KEY ("tracked_problem_id") REFERENCES "tracked_problems"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
