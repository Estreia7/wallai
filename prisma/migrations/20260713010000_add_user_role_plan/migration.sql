-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free';
