-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "institutionId" TEXT;

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Institution_userId_idx" ON "Institution"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_userId_name_key" ON "Institution"("userId", "name");

-- CreateIndex
CREATE INDEX "BankAccount_institutionId_idx" ON "BankAccount"("institutionId");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
