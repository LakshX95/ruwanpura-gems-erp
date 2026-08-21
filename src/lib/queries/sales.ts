import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

const dec = (d: Prisma.Decimal | null | undefined) =>
  d == null ? null : Number(d.toString());

export async function listSales(range?: { from?: Date; to?: Date }) {
  const sales = await db.sale.findMany({
    where:
      range?.from || range?.to
        ? { soldOn: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
        : undefined,
    orderBy: { soldOn: "desc" },
    take: 300,
    include: {
      customer: { select: { name: true } },
      lines: { select: { baseMinor: true, costAtSaleMinor: true, weightCt: true } },
    },
  });

  return sales.map((s) => {
    const revenue = s.lines.reduce((a, l) => a + l.baseMinor, 0n);
    const cost = s.lines.reduce((a, l) => a + l.costAtSaleMinor, 0n);
    return {
      id: s.id,
      saleNo: s.saleNo,
      customer: s.customer.name,
      soldOn: s.soldOn,
      currency: s.currency,
      brokerName: s.brokerName,
      stoneCount: s.lines.length,
      weightCt: s.lines.reduce((a, l) => a + Number(l.weightCt.toString()), 0),
      revenueMinor: revenue,
      costMinor: cost,
      marginMinor: revenue - cost,
      marginPct: revenue > 0n ? (Number(revenue - cost) / Number(revenue)) * 100 : null,
    };
  });
}

export async function getSale(id: string) {
  const s = await db.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { stone: { stoneNo: "asc" } },
        include: {
          stone: {
            select: {
              id: true, stoneNo: true,
              variety: { select: { name: true } },
              colour: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!s) return null;

  return {
    ...s,
    fxRate: dec(s.fxRate)!,
    lines: s.lines.map((l) => ({
      id: l.id,
      stoneId: l.stoneId,
      stoneNo: l.stone.stoneNo,
      variety: l.stone.variety?.name ?? null,
      colour: l.stone.colour?.name ?? null,
      weightCt: dec(l.weightCt)!,
      perCaratMinor: l.perCaratMinor,
      totalMinor: l.totalMinor,
      baseMinor: l.baseMinor,
      costAtSaleMinor: l.costAtSaleMinor,
      marginMinor: l.baseMinor - l.costAtSaleMinor,
    })),
  };
}

export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSale>>>;

/** Stones that can actually be sold — in the safe, not out with anyone. */
export async function sellableStones(limit = 400) {
  const rows = await db.stone.findMany({
    where: { status: "IN_STOCK", kind: { in: ["STONE", "PARCEL"] } },
    orderBy: { stoneNo: "asc" },
    take: limit,
    select: {
      id: true, stoneNo: true, weightCt: true, askingPriceMinor: true,
      variety: { select: { name: true } },
      colour: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  const costs = rows.length
    ? await db.costEntry.groupBy({
        by: ["stoneId"],
        where: { stoneId: { in: rows.map((r) => r.id) } },
        _sum: { baseMinor: true },
      })
    : [];
  const costByStone = new Map(costs.map((c) => [c.stoneId, c._sum.baseMinor ?? 0n]));

  return rows.map((r) => ({
    id: r.id,
    stoneNo: r.stoneNo,
    weightCt: dec(r.weightCt)!,
    variety: r.variety?.name ?? null,
    colour: r.colour?.name ?? null,
    location: r.location?.name ?? null,
    askingPriceMinor: r.askingPriceMinor,
    costMinor: costByStone.get(r.id) ?? 0n,
  }));
}

/** Headline revenue, cost and margin for a period — the reports summary. */
export async function salesSummary(range?: { from?: Date; to?: Date }) {
  const where =
    range?.from || range?.to
      ? {
          sale: {
            soldOn: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          },
        }
      : {};

  const [agg, count] = await Promise.all([
    db.saleLine.aggregate({
      where,
      _sum: { baseMinor: true, costAtSaleMinor: true, weightCt: true },
      _count: true,
    }),
    db.sale.count({
      where:
        range?.from || range?.to
          ? {
              soldOn: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lte: range.to } : {}),
              },
            }
          : undefined,
    }),
  ]);

  const revenue = agg._sum.baseMinor ?? 0n;
  const cost = agg._sum.costAtSaleMinor ?? 0n;

  return {
    sales: count,
    stones: agg._count,
    weightCt: Number(agg._sum.weightCt?.toString() ?? 0),
    revenueMinor: revenue,
    costMinor: cost,
    marginMinor: revenue - cost,
    marginPct: revenue > 0n ? (Number(revenue - cost) / Number(revenue)) * 100 : null,
  };
}

/** Best and worst deals in the period — the two the owner actually asks about. */
export async function marginExtremes(range?: { from?: Date; to?: Date }, take = 5) {
  const rows = await db.saleLine.findMany({
    where:
      range?.from || range?.to
        ? {
            sale: {
              soldOn: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lte: range.to } : {}),
              },
            },
          }
        : {},
    include: {
      sale: { select: { saleNo: true, soldOn: true, customer: { select: { name: true } } } },
      stone: {
        select: {
          id: true, stoneNo: true,
          variety: { select: { name: true } },
          colour: { select: { name: true } },
        },
      },
    },
  });

  const mapped = rows.map((l) => ({
    stoneId: l.stoneId,
    stoneNo: l.stone.stoneNo,
    variety: l.stone.variety?.name ?? null,
    colour: l.stone.colour?.name ?? null,
    saleNo: l.sale.saleNo,
    customer: l.sale.customer.name,
    soldOn: l.sale.soldOn,
    revenueMinor: l.baseMinor,
    costMinor: l.costAtSaleMinor,
    marginMinor: l.baseMinor - l.costAtSaleMinor,
  }));

  mapped.sort((a, b) => Number(b.marginMinor - a.marginMinor));
  return { best: mapped.slice(0, take), worst: mapped.slice(-take).reverse() };
}
