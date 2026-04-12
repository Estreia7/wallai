-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'checking';
