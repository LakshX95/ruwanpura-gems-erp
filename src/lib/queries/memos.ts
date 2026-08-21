import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { MemoStatus } from "@/generated/prisma/enums";

const dec = (d: Prisma.Decimal | null | undefined) =>
  d == null ? null : Number(d.toString());

const daysBetween = (a: Date, b: Date) =>
  Math.floor((a.getTime() - new Date(b).getTime()) / 86_400_000);

export async function listMemos(status?: MemoStatus) {
  const memos = await db.memo.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: "asc" }, { dueBack: "asc" }],
    take: 200,
    include: {
      party: { select: { name: true } },
      lines: {
        select: {
          outcome: true, weightOutCt: true, quotedPriceMinor: true, stoneId: true,
        },
      },
    },
  });

  const outIds = memos.flatMap((m) =>
    m.lines.filter((l) => l.outcome === null).map((l) => l.stoneId),
  );
  const costs = outIds.length
    ? await db.costEntry.groupBy({
        by: ["stoneId"],
        where: { stoneId: { in: outIds } },
        _sum: { baseMinor: true },
      })
    : [];
  const costByStone = new Map(costs.map((c) => [c.stoneId, c._sum.baseMinor ?? 0n]));

  const now = new Date();
  return memos.map((m) => {
    const open = m.lines.filter((l) => l.outcome === null);
    return {
      id: m.id,
      memoNo: m.memoNo,
      status: m.status,
      party: m.party.name,
      issuedOn: m.issuedOn,
      dueBack: m.dueBack,
      closedOn: m.closedOn,
      wasExtended: Boolean(m.extensionNote),
      totalLines: m.lines.length,
      openLines: open.length,
      returned: m.lines.filter((l) => l.outcome === "RETURNED").length,
      sold: m.lines.filter((l) => l.outcome === "SOLD").length,
      lost: m.lines.filter((l) => l.outcome === "LOST").length,
      weightOutCt: open.reduce((a, l) => a + Number(l.weightOutCt.toString()), 0),
      // Value still out is at cost — it is still the business's stock.
      valueOutMinor: open.reduce((a, l) => a + (costByStone.get(l.stoneId) ?? 0n), 0n),
      quotedMinor: open.reduce((a, l) => a + (l.quotedPriceMinor ?? 0n), 0n),
      daysOut: daysBetween(now, m.issuedOn),
      daysOverdue:
        m.status === "OPEN" ? Math.max(0, daysBetween(now, m.dueBack)) : 0,
    };
  });
}

export async function getMemo(id: string) {
  const m = await db.memo.findUnique({
    where: { id },
    include: {
      party: true,
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { stone: { stoneNo: "asc" } },
        include: {
          stone: {
            select: {
              id: true, stoneNo: true, weightCt: true, status: true, certLab: true,
              variety: { select: { name: true } },
              colour: { select: { name: true } },
              shape: { select: { name: true } },
              treatment: { select: { name: true } },
              media: { where: { isMain: true }, select: { thumbUrl: true, url: true }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!m) return null;

  const costs = await db.costEntry.groupBy({
    by: ["stoneId"],
    where: { stoneId: { in: m.lines.map((l) => l.stoneId) } },
    _sum: { baseMinor: true },
  });
  const costByStone = new Map(costs.map((c) => [c.stoneId, c._sum.baseMinor ?? 0n]));
  const now = new Date();

  return {
    ...m,
    daysOut: daysBetween(now, m.issuedOn),
    daysOverdue: m.status === "OPEN" ? Math.max(0, daysBetween(now, m.dueBack)) : 0,
    lines: m.lines.map((l) => ({
      id: l.id,
      stoneId: l.stoneId,
      stoneNo: l.stone.stoneNo,
      variety: l.stone.variety?.name ?? null,
      colour: l.stone.colour?.name ?? null,
      shape: l.stone.shape?.name ?? null,
      treatment: l.stone.treatment?.name ?? null,
      certLab: l.stone.certLab,
      thumbUrl: l.stone.media[0]?.thumbUrl ?? l.stone.media[0]?.url ?? null,
      weightOutCt: dec(l.weightOutCt)!,
      quotedPriceMinor: l.quotedPriceMinor,
      costMinor: costByStone.get(l.stoneId) ?? 0n,
      outcome: l.outcome,
      settledOn: l.settledOn,
      saleId: l.saleId,
      note: l.note,
    })),
  };
}

export type MemoDetail = NonNullable<Awaited<ReturnType<typeof getMemo>>>;

/** Headline exposure — the number the owner wants on the dashboard. */
export async function memoExposure() {
  const rows = await db.memoLine.findMany({
    where: { outcome: null, memo: { status: "OPEN" } },
    select: { stoneId: true, memo: { select: { dueBack: true } } },
  });
  if (rows.length === 0) {
    return { stones: 0, valueMinor: 0n, overdueStones: 0, memos: 0 };
  }

  const costs = await db.costEntry.groupBy({
    by: ["stoneId"],
    where: { stoneId: { in: rows.map((r) => r.stoneId) } },
    _sum: { baseMinor: true },
  });
  const costByStone = new Map(costs.map((c) => [c.stoneId, c._sum.baseMinor ?? 0n]));
  const today = new Date();

  return {
    stones: rows.length,
    valueMinor: rows.reduce((a, r) => a + (costByStone.get(r.stoneId) ?? 0n), 0n),
    overdueStones: rows.filter((r) => new Date(r.memo.dueBack) < today).length,
    memos: await db.memo.count({ where: { status: "OPEN" } }),
  };
}

/** Stones that can go out on memo. */
export async function memoableStones(limit = 400) {
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
  return rows.map((r) => ({
    id: r.id,
    stoneNo: r.stoneNo,
    weightCt: dec(r.weightCt)!,
    variety: r.variety?.name ?? null,
    colour: r.colour?.name ?? null,
    location: r.location?.name ?? null,
    askingPriceMinor: r.askingPriceMinor,
  }));
}

/** How reliable a party has been with goods on approval. */
export async function partyMemoHistory() {
  return db.$queryRaw<
    {
      party: string; memos: bigint; stones: bigint; returned: bigint;
      sold: bigint; lost: bigint; still_out: bigint; avg_days: number | null;
    }[]
  >(Prisma.sql`
    SELECT p.name AS party,
           count(DISTINCT m.id)::bigint AS memos,
           count(l.id)::bigint AS stones,
           count(*) FILTER (WHERE l.outcome = 'RETURNED')::bigint AS returned,
           count(*) FILTER (WHERE l.outcome = 'SOLD')::bigint AS sold,
           count(*) FILTER (WHERE l.outcome = 'LOST')::bigint AS lost,
           count(*) FILTER (WHERE l.outcome IS NULL)::bigint AS still_out,
           avg(l.settled_on - m.issued_on)::float AS avg_days
    FROM memo m
    JOIN memo_line l ON l.memo_id = m.id
    JOIN party p ON p.id = m.party_id
    GROUP BY p.name
    ORDER BY still_out DESC, stones DESC
  `);
}
