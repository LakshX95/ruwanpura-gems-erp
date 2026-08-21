import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { JobKind, JobStatus } from "@/generated/prisma/enums";

const dec = (d: Prisma.Decimal | null | undefined): number | null =>
  d == null ? null : Number(d.toString());

export async function listJobs(filters: { status?: JobStatus; kind?: JobKind }) {
  const jobs = await db.job.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
    },
    orderBy: [{ status: "asc" }, { issuedOn: "desc" }],
    take: 100,
    include: {
      vendor: { select: { name: true } },
      lines: { select: { weightOutCt: true, weightInCt: true, outcome: true, chargeMinor: true } },
    },
  });

  const today = Date.now();
  return jobs.map((j) => {
    const out = j.lines.reduce((a, l) => a + Number(l.weightOutCt.toString()), 0);
    const back = j.lines.reduce((a, l) => a + Number(l.weightInCt?.toString() ?? 0), 0);
    const charge = j.lines.reduce((a, l) => a + (l.chargeMinor ?? 0n), 0n);
    const lostCount = j.lines.filter(
      (l) => l.outcome === "LOST" || l.outcome === "BROKEN",
    ).length;
    const overdueDays =
      j.status === "OPEN" && j.expectedBack
        ? Math.floor((today - new Date(j.expectedBack).getTime()) / 86_400_000)
        : 0;

    return {
      id: j.id,
      jobNo: j.jobNo,
      kind: j.kind,
      status: j.status,
      vendor: j.vendor.name,
      issuedOn: j.issuedOn,
      expectedBack: j.expectedBack,
      returnedOn: j.returnedOn,
      stoneCount: j.lines.length,
      weightOutCt: out,
      weightInCt: j.status === "CLOSED" ? back : null,
      yieldPct: j.status === "CLOSED" && out > 0 ? (back / out) * 100 : null,
      chargeMinor: charge,
      lostCount,
      overdueDays: overdueDays > 0 ? overdueDays : 0,
    };
  });
}

export async function getJob(id: string) {
  const j = await db.job.findUnique({
    where: { id },
    include: {
      vendor: true,
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { stone: { stoneNo: "asc" } },
        include: {
          stone: {
            select: {
              id: true, stoneNo: true, weightCt: true, status: true,
              variety: { select: { name: true } },
              colour: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!j) return null;

  // Computed here rather than in the page: reading the clock during render is
  // impure and React flags it.
  const overdueDays =
    j.status === "OPEN" && j.expectedBack
      ? Math.max(
          0,
          Math.floor((Date.now() - new Date(j.expectedBack).getTime()) / 86_400_000),
        )
      : 0;
  const turnaroundDays = j.returnedOn
    ? Math.round(
        (new Date(j.returnedOn).getTime() - new Date(j.issuedOn).getTime()) /
          86_400_000,
      )
    : null;

  return {
    ...j,
    overdueDays,
    turnaroundDays,
    lines: j.lines.map((l) => ({
      id: l.id,
      stoneId: l.stoneId,
      stoneNo: l.stone.stoneNo,
      variety: l.stone.variety?.name ?? null,
      colour: l.stone.colour?.name ?? null,
      stoneStatus: l.stone.status,
      weightOutCt: dec(l.weightOutCt)!,
      weightInCt: dec(l.weightInCt),
      outcome: l.outcome,
      chargeMinor: l.chargeMinor,
      note: l.note,
      yieldPct:
        l.weightInCt != null && Number(l.weightOutCt.toString()) > 0
          ? (Number(l.weightInCt.toString()) / Number(l.weightOutCt.toString())) * 100
          : null,
    })),
  };
}

export type JobDetail = NonNullable<Awaited<ReturnType<typeof getJob>>>;

/** Stones available to send out, for the job picker. */
export async function availableStones(q?: string, limit = 60) {
  const where: Prisma.StoneWhereInput = {
    status: "IN_STOCK",
    kind: { in: ["STONE", "LOT"] },
  };
  if (q?.trim()) {
    where.OR = [
      { stoneNo: { contains: q.trim(), mode: "insensitive" } },
      { variety: { name: { contains: q.trim(), mode: "insensitive" } } },
    ];
  }
  const rows = await db.stone.findMany({
    where,
    orderBy: { stoneNo: "asc" },
    take: limit,
    select: {
      id: true, stoneNo: true, weightCt: true,
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
  }));
}

/**
 * Which cutter actually gives the best recovery — the question the owner has
 * an opinion about but no evidence for. This is the report that pays for the
 * whole module.
 */
export async function vendorPerformance(range?: { from?: Date; to?: Date }) {
  // Period applies to when the work came back, which is when the yield was
  // actually realised — not when the stones went out.
  const period = Prisma.sql`
    ${range?.from ? Prisma.sql`AND j.returned_on >= ${range.from}::date` : Prisma.empty}
    ${range?.to ? Prisma.sql`AND j.returned_on <= ${range.to}::date` : Prisma.empty}
  `;
  return db.$queryRaw<
    {
      vendor: string; kind: string; jobs: bigint; stones: bigint;
      out_ct: string; in_ct: string; yield_pct: number | null;
      lost: bigint; avg_days: number | null; charged: bigint | null;
    }[]
  >(Prisma.sql`
    SELECT p.name AS vendor,
           j.kind::text AS kind,
           count(DISTINCT j.id)::bigint AS jobs,
           count(l.id)::bigint AS stones,
           sum(l.weight_out_ct)::text AS out_ct,
           sum(COALESCE(l.weight_in_ct, 0))::text AS in_ct,
           CASE WHEN sum(l.weight_out_ct) > 0
                THEN (sum(COALESCE(l.weight_in_ct,0)) / sum(l.weight_out_ct) * 100)::float
           END AS yield_pct,
           count(*) FILTER (WHERE l.outcome IN ('LOST','BROKEN'))::bigint AS lost,
           avg(j.returned_on - j.issued_on)::float AS avg_days,
           sum(COALESCE(l.charge_minor,0))::bigint AS charged
    FROM job j
    JOIN job_line l ON l.job_id = j.id
    JOIN party p ON p.id = j.vendor_id
    WHERE j.status = 'CLOSED' ${period}
    GROUP BY p.name, j.kind
    ORDER BY j.kind, yield_pct DESC NULLS LAST
  `);
}

export async function openJobCount() {
  return db.job.count({ where: { status: "OPEN" } });
}
