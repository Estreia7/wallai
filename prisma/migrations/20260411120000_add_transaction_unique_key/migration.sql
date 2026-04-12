-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_bankAccountId_date_description_amount_key" ON "Transaction"("userId", "bankAccountId", "date", "description", "amount");
