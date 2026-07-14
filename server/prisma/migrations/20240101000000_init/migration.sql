-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('ACTIVE', 'MASTERED');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('PASS', 'FAIL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "tags" TEXT[],
    "url" TEXT NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_problems" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "problem_id" INTEGER NOT NULL,
    "initial_solved_at" DATE NOT NULL,
    "current_stage" INTEGER NOT NULL DEFAULT 0,
    "next_due_date" DATE,
    "status" "TrackStatus" NOT NULL DEFAULT 'ACTIVE',
    "reset_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "tracked_problem_id" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "attempted_at" DATE NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "failure_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" TEXT NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_problems_user_id_problem_id_key" ON "tracked_problems"("user_id", "problem_id");

-- CreateIndex
CREATE INDEX "tracked_problems_user_id_status_next_due_date_idx" ON "tracked_problems"("user_id", "status", "next_due_date");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- AddForeignKey
ALTER TABLE "tracked_problems" ADD CONSTRAINT "tracked_problems_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_problems" ADD CONSTRAINT "tracked_problems_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_tracked_problem_id_fkey" FOREIGN KEY ("tracked_problem_id") REFERENCES "tracked_problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
