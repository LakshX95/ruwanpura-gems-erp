-- CreateEnum
CREATE TYPE "MemoStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MemoLineOutcome" AS ENUM ('RETURNED', 'SOLD', 'LOST');

-- CreateTable
CREATE TABLE "memo" (
    "id" UUID NOT NULL,
    "memo_no" TEXT NOT NULL,
    "status" "MemoStatus" NOT NULL DEFAULT 'OPEN',
    "party_id" UUID NOT NULL,
    "issued_on" DATE NOT NULL,
    "due_back" DATE NOT NULL,
    "closed_on" DATE,
    "extension_note" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memo_line" (
    "id" UUID NOT NULL,
    "memo_id" UUID NOT NULL,
    "stone_id" UUID NOT NULL,
    "weight_out_ct" DECIMAL(12,3) NOT NULL,
    "quoted_price_minor" BIGINT,
    "outcome" "MemoLineOutcome",
    "settled_on" DATE,
    "sale_id" UUID,
    "note" TEXT,

    CONSTRAINT "memo_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memo_memo_no_key" ON "memo"("memo_no");

-- CreateIndex
CREATE INDEX "memo_status_idx" ON "memo"("status");

-- CreateIndex
CREATE INDEX "memo_party_id_idx" ON "memo"("party_id");

-- CreateIndex
CREATE INDEX "memo_due_back_idx" ON "memo"("due_back");

-- CreateIndex
CREATE INDEX "memo_line_stone_id_idx" ON "memo_line"("stone_id");

-- CreateIndex
CREATE UNIQUE INDEX "memo_line_memo_id_stone_id_key" ON "memo_line"("memo_id", "stone_id");

-- AddForeignKey
ALTER TABLE "memo" ADD CONSTRAINT "memo_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memo" ADD CONSTRAINT "memo_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memo_line" ADD CONSTRAINT "memo_line_memo_id_fkey" FOREIGN KEY ("memo_id") REFERENCES "memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memo_line" ADD CONSTRAINT "memo_line_stone_id_fkey" FOREIGN KEY ("stone_id") REFERENCES "stone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
