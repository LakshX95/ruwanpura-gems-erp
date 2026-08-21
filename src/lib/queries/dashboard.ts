import "server-only";
import { db } from "@/lib/db";
import { memoExposure } from "@/lib/queries/memos";
import { Prisma } from "@/generated/prisma/client";

/** Statuses that still represent owned, un-realised stock. */
const HELD = ["IN_STOCK", "OUT"] as const;

export async function getDashboard() {
  const [
    inStockCount,
    outCount,
    weightAgg,
    heldCostAgg,
    outCostAgg,
    soldCount,
    lotCount,
    openJobs,
    memo,
  ] = await Promise.all([
    db.stone.count({ where: { status: "IN_STOCK" } }),
    db.stone.count({ where: { status: "OUT" } }),
    db.stone.aggregate({
      where: { status: { in: [...HELD] } },
      _sum: { weightCt: true },
    }),
    db.costEntry.aggregate({
      where: { stone: { status: { in: [...HELD] } } },
      _sum: { baseMinor: true },
    }),
    db.costEntry.aggregate({
      where: { stone: { status: "OUT" } },
      _sum: { baseMinor: true },
    }),
    db.stone.count({ where: { status: "SOLD" } }),
    db.stone.count({ where: { kind: "LOT", status: "IN_STOCK" } }),
    db.job.count({ where: { status: "OPEN" } }),
    memoExposure(),
  ]);

  // Anything sent out whose expected return date has passed and which has not
  // come back. This is the number that stops stock quietly disappearing.
  const overdue = await db.$queryRaw<
    { id: string; stone_no: string; party: string | null; expected_back: Date; days_over: number }[]
  >(Prisma.sql`
    SELECT s.id,
           s.stone_no,
           p.name AS party,
           e.expected_back,
           (CURRENT_DATE - e.expected_back)::int AS days_over
    FROM stone s
    JOIN LATERAL (
      SELECT * FROM custody_event ce
      WHERE ce.stone_id = s.id
      ORDER BY ce.occurred_at DESC
      LIMIT 1
    ) e ON true
    LEFT JOIN party p ON p.id = e.to_party_id
    WHERE s.status = 'OUT'
      AND e.expected_back IS NOT NULL
      AND e.expected_back < CURRENT_DATE
    ORDER BY days_over DESC
    LIMIT 8
  `);

  const overdueCount = await db.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT count(*)::bigint AS n
    FROM stone s
    JOIN LATERAL (
      SELECT * FROM custody_event ce
      WHERE ce.stone_id = s.id ORDER BY ce.occurred_at DESC LIMIT 1
    ) e ON true
    WHERE s.status = 'OUT' AND e.expected_back IS NOT NULL AND e.expected_back < CURRENT_DATE
  `);

  // Capital tied up by age. Dead stock is where a gem business quietly loses
  // money, so the aging bands are on the front page, not buried in a report.
  const aging = await db.$queryRaw<
    { bucket: string; n: bigint; cost: bigint | null }[]
  >(Prisma.sql`
    SELECT bucket, count(*)::bigint AS n, sum(cost)::bigint AS cost
    FROM (
      SELECT s.id,
             CASE
               WHEN s.created_at > now() - interval '90 days'  THEN '0-3 months'
               WHEN s.created_at > now() - interval '180 days' THEN '3-6 months'
               WHEN s.created_at > now() - interval '365 days' THEN '6-12 months'
               WHEN s.created_at > now() - interval '730 days' THEN '1-2 years'
               ELSE 'Over 2 years'
             END AS bucket,
             COALESCE((SELECT sum(c.base_minor) FROM cost_entry c WHERE c.stone_id = s.id), 0) AS cost
      FROM stone s
      WHERE s.status IN ('IN_STOCK','OUT')
    ) t
    GROUP BY bucket
  `);

  const byVariety = await db.$queryRaw<
    { name: string; n: bigint; weight: string; cost: bigint | null }[]
  >(Prisma.sql`
    SELECT v.name,
           count(*)::bigint AS n,
           sum(s.weight_ct)::text AS weight,
           sum(COALESCE((SELECT sum(c.base_minor) FROM cost_entry c WHERE c.stone_id = s.id), 0))::bigint AS cost
    FROM stone s
    JOIN ref_variety v ON v.id = s.variety_id
    WHERE s.status IN ('IN_STOCK','OUT') AND s.kind = 'STONE'
    GROUP BY v.name
    ORDER BY cost DESC NULLS LAST
    LIMIT 7
  `);

  const recent = await db.stone.findMany({
    where: { status: { in: [...HELD] } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true, stoneNo: true, weightCt: true, createdAt: true, status: true,
      variety: { select: { name: true } },
      colour: { select: { name: true } },
    },
  });

  const BUCKET_ORDER = ["0-3 months", "3-6 months", "6-12 months", "1-2 years", "Over 2 years"];

  return {
    inStockCount,
    outCount,
    lotCount,
    soldCount,
    openJobs,
    memo,
    totalWeightCt: Number(weightAgg._sum.weightCt?.toString() ?? 0),
    heldCostMinor: heldCostAgg._sum.baseMinor ?? 0n,
    outCostMinor: outCostAgg._sum.baseMinor ?? 0n,
    overdueCount: Number(overdueCount[0]?.n ?? 0n),
    overdue: overdue.map((o) => ({
      id: o.id,
      stoneNo: o.stone_no,
      party: o.party,
      expectedBack: o.expected_back,
      daysOver: o.days_over,
    })),
    aging: BUCKET_ORDER.map((bucket) => {
      const row = aging.find((a) => a.bucket === bucket);
      return { bucket, count: Number(row?.n ?? 0n), costMinor: row?.cost ?? 0n };
    }),
    byVariety: byVariety.map((v) => ({
      name: v.name,
      count: Number(v.n),
      weightCt: Number(v.weight ?? 0),
      costMinor: v.cost ?? 0n,
    })),
    recent: recent.map((r) => ({
      id: r.id,
      stoneNo: r.stoneNo,
      weightCt: Number(r.weightCt.toString()),
      createdAt: r.createdAt,
      status: r.status,
      variety: r.variety?.name ?? null,
      colour: r.colour?.name ?? null,
    })),
  };
}
