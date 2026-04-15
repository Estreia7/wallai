/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `Book` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "traitSource" TEXT,
ADD COLUMN     "traits" DOUBLE PRECISION[],
ADD COLUMN     "traitsGeneratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserBook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rating" INTEGER,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "UserBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBookHidden" (
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBookHidden_pkey" PRIMARY KEY ("userId","bookId")
);

-- CreateIndex
CREATE INDEX "UserBook_userId_idx" ON "UserBook"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBook_userId_bookId_key" ON "UserBook"("userId", "bookId");

-- CreateIndex
CREATE INDEX "UserBookHidden_userId_idx" ON "UserBookHidden"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_externalId_key" ON "Book"("externalId");

-- CreateIndex
CREATE INDEX "Book_externalId_idx" ON "Book"("externalId");

-- AddForeignKey
ALTER TABLE "UserBook" ADD CONSTRAINT "UserBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBook" ADD CONSTRAINT "UserBook_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookHidden" ADD CONSTRAINT "UserBookHidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookHidden" ADD CONSTRAINT "UserBookHidden_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
