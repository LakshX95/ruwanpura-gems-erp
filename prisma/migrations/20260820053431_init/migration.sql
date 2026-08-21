-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'CLERK');

-- CreateEnum
CREATE TYPE "StoneKind" AS ENUM ('LOT', 'STONE', 'PARCEL');

-- CreateEnum
CREATE TYPE "StoneStatus" AS ENUM ('IN_STOCK', 'OUT', 'SOLD', 'WRITTEN_OFF', 'CONSUMED');

-- CreateEnum
CREATE TYPE "CostKind" AS ENUM ('PURCHASE', 'ALLOCATION', 'CUTTING', 'HEATING', 'LAB', 'FREIGHT', 'BROKERAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "TransformKind" AS ENUM ('SPLIT', 'MERGE', 'RECUT');

-- CreateEnum
CREATE TYPE "CustodyReason" AS ENUM ('RECEIPT', 'INTERNAL_MOVE', 'CUTTING', 'HEATING', 'LAB', 'MEMO', 'SHOW', 'RETURN', 'SALE');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLERK',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "is_supplier" BOOLEAN NOT NULL DEFAULT false,
    "isVendor" BOOLEAN NOT NULL DEFAULT false,
    "is_customer" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_variety" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT,
    "sort_key" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ref_variety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_shape" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_key" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ref_shape_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_colour" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_key" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ref_colour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_treatment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "disclosure" TEXT,
    "sort_key" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ref_treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stone" (
    "id" UUID NOT NULL,
    "stoneNo" TEXT NOT NULL,
    "kind" "StoneKind" NOT NULL DEFAULT 'STONE',
    "status" "StoneStatus" NOT NULL DEFAULT 'IN_STOCK',
    "weight_ct" DECIMAL(12,3) NOT NULL,
    "pieceCount" INTEGER NOT NULL DEFAULT 1,
    "variety_id" UUID,
    "shape_id" UUID,
    "colour_id" UUID,
    "treatment_id" UUID,
    "clarity" TEXT,
    "length_mm" DECIMAL(8,2),
    "width_mm" DECIMAL(8,2),
    "depth_mm" DECIMAL(8,2),
    "origin" TEXT,
    "cert_lab" TEXT,
    "cert_no" TEXT,
    "location_id" UUID,
    "held_by_id" UUID,
    "asking_price_minor" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "purchase_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "stone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_entry" (
    "id" UUID NOT NULL,
    "stone_id" UUID NOT NULL,
    "kind" "CostKind" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "fx_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "base_minor" BIGINT NOT NULL,
    "incurred_on" DATE NOT NULL,
    "source_doc" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transformation" (
    "id" UUID NOT NULL,
    "kind" "TransformKind" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loss_ct" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "cost_alloc_method" TEXT NOT NULL DEFAULT 'by_weight',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transformation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transformation_line" (
    "id" UUID NOT NULL,
    "transformation_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "stone_id" UUID NOT NULL,
    "weight_ct" DECIMAL(12,3) NOT NULL,
    "cost_share_minor" BIGINT,

    CONSTRAINT "transformation_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_event" (
    "id" UUID NOT NULL,
    "stone_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "CustodyReason" NOT NULL,
    "to_party_id" UUID,
    "to_location_id" UUID,
    "weight_ct" DECIMAL(12,3) NOT NULL,
    "expected_back" DATE,
    "voucher_no" TEXT,
    "note" TEXT,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "custody_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "stone_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "thumb_url" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase" (
    "id" UUID NOT NULL,
    "purchase_no" TEXT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "purchased_on" DATE NOT NULL,
    "description" TEXT,
    "weight_ct" DECIMAL(12,3) NOT NULL,
    "total_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "broker_name" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "table_name" TEXT NOT NULL,
    "row_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "party_name_idx" ON "party"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ref_variety_name_key" ON "ref_variety"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ref_shape_name_key" ON "ref_shape"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ref_colour_name_key" ON "ref_colour"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ref_treatment_name_key" ON "ref_treatment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "stone_stoneNo_key" ON "stone"("stoneNo");

-- CreateIndex
CREATE INDEX "stone_status_idx" ON "stone"("status");

-- CreateIndex
CREATE INDEX "stone_variety_id_idx" ON "stone"("variety_id");

-- CreateIndex
CREATE INDEX "stone_location_id_idx" ON "stone"("location_id");

-- CreateIndex
CREATE INDEX "stone_held_by_id_idx" ON "stone"("held_by_id");

-- CreateIndex
CREATE INDEX "stone_created_at_idx" ON "stone"("created_at");

-- CreateIndex
CREATE INDEX "cost_entry_stone_id_incurred_on_idx" ON "cost_entry"("stone_id", "incurred_on");

-- CreateIndex
CREATE INDEX "transformation_line_stone_id_idx" ON "transformation_line"("stone_id");

-- CreateIndex
CREATE UNIQUE INDEX "transformation_line_transformation_id_direction_stone_id_key" ON "transformation_line"("transformation_id", "direction", "stone_id");

-- CreateIndex
CREATE INDEX "custody_event_stone_id_occurred_at_idx" ON "custody_event"("stone_id", "occurred_at");

-- CreateIndex
CREATE INDEX "media_stone_id_idx" ON "media"("stone_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_purchase_no_key" ON "purchase"("purchase_no");

-- CreateIndex
CREATE INDEX "purchase_purchased_on_idx" ON "purchase"("purchased_on");

-- CreateIndex
CREATE INDEX "audit_log_table_name_row_id_idx" ON "audit_log"("table_name", "row_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stone" ADD CONSTRAINT "stone_variety_id_fkey" FOREIGN KEY ("variety_id") REFERENCES "ref_variety"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stone" ADD CONSTRAINT "stone_shape_id_fkey" FOREIGN KEY ("shape_id") REFERENCES "ref_shape"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stone" ADD CONSTRAINT "stone_colour_id_fkey" FOREIGN KEY ("colour_id") REFERENCES "ref_colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stone" ADD CONSTRAINT "stone_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "ref_treatment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stone" ADD CONSTRAINT "stone_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stone" ADD CONSTRAINT "stone_held_by_id_fkey" FOREIGN KEY ("held_by_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stone" ADD CONSTRAINT "stone_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stone" ADD CONSTRAINT "stone_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entry" ADD CONSTRAINT "cost_entry_stone_id_fkey" FOREIGN KEY ("stone_id") REFERENCES "stone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformation_line" ADD CONSTRAINT "transformation_line_transformation_id_fkey" FOREIGN KEY ("transformation_id") REFERENCES "transformation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformation_line" ADD CONSTRAINT "transformation_line_stone_id_fkey" FOREIGN KEY ("stone_id") REFERENCES "stone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_event" ADD CONSTRAINT "custody_event_stone_id_fkey" FOREIGN KEY ("stone_id") REFERENCES "stone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_event" ADD CONSTRAINT "custody_event_to_party_id_fkey" FOREIGN KEY ("to_party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_event" ADD CONSTRAINT "custody_event_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_event" ADD CONSTRAINT "custody_event_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_stone_id_fkey" FOREIGN KEY ("stone_id") REFERENCES "stone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
