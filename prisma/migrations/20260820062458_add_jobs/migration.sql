-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('CUTTING', 'HEATING', 'LAB');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobLineOutcome" AS ENUM ('RETURNED', 'LOST', 'BROKEN', 'REJECTED');

-- CreateTable
CREATE TABLE "job" (
    "id" UUID NOT NULL,
    "job_no" TEXT NOT NULL,
    "kind" "JobKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "vendor_id" UUID NOT NULL,
    "issued_on" DATE NOT NULL,
    "expected_back" DATE,
    "returned_on" DATE,
    "charge_basis" TEXT NOT NULL DEFAULT 'per_stone',
    "instructions" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_line" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "stone_id" UUID NOT NULL,
    "weight_out_ct" DECIMAL(12,3) NOT NULL,
    "weight_in_ct" DECIMAL(12,3),
    "outcome" "JobLineOutcome",
    "charge_minor" BIGINT,
    "note" TEXT,

    CONSTRAINT "job_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_job_no_key" ON "job"("job_no");

-- CreateIndex
CREATE INDEX "job_status_idx" ON "job"("status");

-- CreateIndex
CREATE INDEX "job_vendor_id_idx" ON "job"("vendor_id");

-- CreateIndex
CREATE INDEX "job_issued_on_idx" ON "job"("issued_on");

-- CreateIndex
CREATE INDEX "job_line_stone_id_idx" ON "job_line"("stone_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_line_job_id_stone_id_key" ON "job_line"("job_id", "stone_id");

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_line" ADD CONSTRAINT "job_line_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_line" ADD CONSTRAINT "job_line_stone_id_fkey" FOREIGN KEY ("stone_id") REFERENCES "stone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "stone_stoneNo_key" RENAME TO "stone_stone_no_key";
