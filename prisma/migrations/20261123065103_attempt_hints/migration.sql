-- AlterTable
ALTER TABLE "GameAttempt" ADD COLUMN     "hintsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastHint" JSONB;
