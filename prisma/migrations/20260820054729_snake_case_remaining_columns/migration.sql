-- Four columns kept camelCase names because their @map attribute was appended
-- after a trailing comment. Renaming rather than dropping preserves the data.
ALTER TABLE "party"      RENAME COLUMN "isVendor"   TO "is_vendor";
ALTER TABLE "stone"      RENAME COLUMN "stoneNo"    TO "stone_no";
ALTER TABLE "stone"      RENAME COLUMN "pieceCount" TO "piece_count";
ALTER TABLE "cost_entry" RENAME COLUMN "amountMinor" TO "amount_minor";
