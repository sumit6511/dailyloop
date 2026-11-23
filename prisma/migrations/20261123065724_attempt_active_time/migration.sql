-- AlterTable
ALTER TABLE "GameAttempt" ADD COLUMN     "activeMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3);
