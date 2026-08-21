-- CreateTable
CREATE TABLE "sale" (
    "id" UUID NOT NULL,
    "sale_no" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "sold_on" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "fx_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "broker_name" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_line" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "stone_id" UUID NOT NULL,
    "weight_ct" DECIMAL(12,3) NOT NULL,
    "per_carat_minor" BIGINT,
    "total_minor" BIGINT NOT NULL,
    "base_minor" BIGINT NOT NULL,
    "cost_at_sale_minor" BIGINT NOT NULL,

    CONSTRAINT "sale_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sale_sale_no_key" ON "sale"("sale_no");

-- CreateIndex
CREATE INDEX "sale_sold_on_idx" ON "sale"("sold_on");

-- CreateIndex
CREATE INDEX "sale_customer_id_idx" ON "sale"("customer_id");

-- CreateIndex
CREATE INDEX "sale_line_stone_id_idx" ON "sale_line"("stone_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_line_sale_id_stone_id_key" ON "sale_line"("sale_id", "stone_id");

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_stone_id_fkey" FOREIGN KEY ("stone_id") REFERENCES "stone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
