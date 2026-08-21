import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { CustodyReason } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";

export type SaleLineInput = {
  stoneId: string;
  /** Price per carat in minor units. Either this or totalMinor must be given. */
  perCaratMinor: bigint | null;
  totalMinor: bigint | null;
};

export type CreateSaleInput = {
  customerId: string;
  soldOn: Date;
  currency: string;
  fxRate: number;
  brokerName?: string | null;
  note?: string | null;
  lines: SaleLineInput[];
};

export async function nextSaleNo(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.sale.findFirst({
    where: { saleNo: { startsWith: `SAL-${year}-` } },
    orderBy: { saleNo: "desc" },
    select: { saleNo: true },
  });
  const n = last ? parseInt(last.saleNo.split("-")[2], 10) + 1 : 1;
  return `SAL-${year}-${String(n).padStart(4, "0")}`;
}

export async function createSale(input: CreateSaleInput, user: SessionUser) {
  if (input.lines.length === 0) throw new Error("Add at least one stone to the sale.");

  const stones = await db.stone.findMany({
    where: { id: { in: input.lines.map((l) => l.stoneId) } },
    select: { id: true, stoneNo: true, status: true, weightCt: true, heldById: true },
  });
  if (stones.length !== input.lines.length) {
    throw new Error("One or more stones no longer exist.");
  }
  // A stone already out on memo *with this buyer* is exactly what a converted
  // memo looks like, so it is sellable without coming back to the safe first.
  // Anything out with someone else must return before it can be sold.
  const unavailable = stones.filter(
    (s) =>
      s.status !== "IN_STOCK" &&
      !(s.status === "OUT" && s.heldById === input.customerId),
  );
  if (unavailable.length) {
    throw new Error(
      `Not available to sell: ${unavailable.map((s) => s.stoneNo).join(", ")}. ` +
        `A stone out with a cutter, or on memo with someone else, must come back first.`,
    );
  }

  // Landed cost is snapshotted per line. Cost keeps accruing on a stone, and a
  // margin figure recorded today must not shift when a late invoice is posted.
  const costs = await db.costEntry.groupBy({
    by: ["stoneId"],
    where: { stoneId: { in: stones.map((s) => s.id) } },
    _sum: { baseMinor: true },
  });
  const costByStone = new Map(costs.map((c) => [c.stoneId, c._sum.baseMinor ?? 0n]));
  const byId = new Map(stones.map((s) => [s.id, s]));
  const fx = new Prisma.Decimal(input.fxRate);

  const lines = input.lines.map((l) => {
    const stone = byId.get(l.stoneId)!;
    const weight = Number(stone.weightCt.toString());

    let total = l.totalMinor;
    let perCarat = l.perCaratMinor;
    // The trade quotes per carat; the total is the derived figure. Either one
    // may be typed, and the other is worked out from the weight.
    if (total == null && perCarat != null) {
      total = BigInt(Math.round(Number(perCarat) * weight));
    } else if (total != null && perCarat == null && weight > 0) {
      perCarat = BigInt(Math.round(Number(total) / weight));
    }
    if (total == null || total < 0n) {
      throw new Error(`Enter a price for ${stone.stoneNo}.`);
    }

    return {
      stoneId: l.stoneId,
      weightCt: stone.weightCt,
      perCaratMinor: perCarat,
      totalMinor: total,
      baseMinor: BigInt(Math.round(Number(total) * input.fxRate)),
      costAtSaleMinor: costByStone.get(l.stoneId) ?? 0n,
    };
  });

  const saleNo = await nextSaleNo();

  return db.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        saleNo,
        customerId: input.customerId,
        soldOn: input.soldOn,
        currency: input.currency,
        fxRate: fx,
        brokerName: input.brokerName ?? null,
        note: input.note ?? null,
        createdById: user.id,
        lines: { create: lines },
      },
    });

    for (const l of lines) {
      await tx.stone.update({
        where: { id: l.stoneId },
        data: { status: "SOLD", heldById: input.customerId, locationId: null },
      });
      await tx.custodyEvent.create({
        data: {
          stoneId: l.stoneId,
          reason: CustodyReason.SALE,
          weightCt: l.weightCt,
          toPartyId: input.customerId,
          occurredAt: input.soldOn,
          voucherNo: saleNo,
          createdById: user.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        tableName: "sale",
        rowId: sale.id,
        action: "create",
        actorId: user.id,
        changes: { saleNo, stones: lines.length },
      },
    });

    return sale;
  });
}
