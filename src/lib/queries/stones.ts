import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { StoneKind, StoneStatus } from "@/generated/prisma/enums";

/**
 * Query layer. Everything crossing into a React component is a plain
 * serialisable object: Prisma's Decimal and BigInt do not survive the server/
 * client boundary, and neither should ever be turned into a float by accident
 * somewhere in a component.
 */

const dec = (d: Prisma.Decimal | null | undefined): number | null =>
  d == null ? null : Number(d.toString());

export type StoneListItem = {
  id: string;
  stoneNo: string;
  kind: StoneKind;
  status: StoneStatus;
  weightCt: number;
  pieceCount: number;
  variety: string | null;
  shape: string | null;
  colour: string | null;
  treatment: string | null;
  clarity: string | null;
  certLab: string | null;
  location: string | null;
  heldBy: string | null;
  askingPriceMinor: bigint | null;
  totalCostMinor: bigint;
  thumbUrl: string | null;
  createdAt: Date;
};

export type StoneFilters = {
  q?: string;
  varietyId?: string;
  status?: StoneStatus;
  treatmentId?: string;
  locationId?: string;
  minCt?: number;
  maxCt?: number;
  page?: number;
  perPage?: number;
  sort?: "recent" | "weight" | "stoneNo" | "cost";
};

export const PER_PAGE = 40;

function buildWhere(f: StoneFilters): Prisma.StoneWhereInput {
  const where: Prisma.StoneWhereInput = {};
  const and: Prisma.StoneWhereInput[] = [];

  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({
      OR: [
        { stoneNo: { contains: q, mode: "insensitive" } },
        { certNo: { contains: q, mode: "insensitive" } },
        { note: { contains: q, mode: "insensitive" } },
        { variety: { name: { contains: q, mode: "insensitive" } } },
        { colour: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.varietyId) and.push({ varietyId: f.varietyId });
  if (f.status) and.push({ status: f.status });
  if (f.treatmentId) and.push({ treatmentId: f.treatmentId });
  if (f.locationId) and.push({ locationId: f.locationId });
  if (f.minCt != null) and.push({ weightCt: { gte: new Prisma.Decimal(f.minCt) } });
  if (f.maxCt != null) and.push({ weightCt: { lte: new Prisma.Decimal(f.maxCt) } });

  if (and.length) where.AND = and;
  return where;
}

const ORDER: Record<
  NonNullable<StoneFilters["sort"]>,
  Prisma.StoneOrderByWithRelationInput
> = {
  recent: { createdAt: "desc" },
  weight: { weightCt: "desc" },
  stoneNo: { stoneNo: "asc" },
  cost: { createdAt: "desc" }, // cost lives in a ledger; sorted after the fetch
};

export async function listStones(filters: StoneFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? PER_PAGE;
  const where = buildWhere(filters);

  const [rows, total] = await Promise.all([
    db.stone.findMany({
      where,
      orderBy: ORDER[filters.sort ?? "recent"],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, stoneNo: true, kind: true, status: true,
        weightCt: true, pieceCount: true, clarity: true, certLab: true,
        askingPriceMinor: true, createdAt: true,
        variety: { select: { name: true } },
        shape: { select: { name: true } },
        colour: { select: { name: true } },
        treatment: { select: { name: true } },
        location: { select: { name: true } },
        heldBy: { select: { name: true } },
        media: {
          where: { isMain: true },
          select: { thumbUrl: true, url: true },
          take: 1,
        },
      },
    }),
    db.stone.count({ where }),
  ]);

  // Landed cost comes from the ledger, so it is fetched for this page's rows
  // in one grouped query rather than N per-row aggregates.
  const costs = rows.length
    ? await db.costEntry.groupBy({
        by: ["stoneId"],
        where: { stoneId: { in: rows.map((r) => r.id) } },
        _sum: { baseMinor: true },
      })
    : [];
  const costByStone = new Map(costs.map((c) => [c.stoneId, c._sum.baseMinor ?? 0n]));

  const items: StoneListItem[] = rows.map((r) => ({
    id: r.id,
    stoneNo: r.stoneNo,
    kind: r.kind,
    status: r.status,
    weightCt: dec(r.weightCt)!,
    pieceCount: r.pieceCount,
    variety: r.variety?.name ?? null,
    shape: r.shape?.name ?? null,
    colour: r.colour?.name ?? null,
    treatment: r.treatment?.name ?? null,
    clarity: r.clarity,
    certLab: r.certLab,
    location: r.location?.name ?? null,
    heldBy: r.heldBy?.name ?? null,
    askingPriceMinor: r.askingPriceMinor,
    totalCostMinor: costByStone.get(r.id) ?? 0n,
    thumbUrl: r.media[0]?.thumbUrl ?? r.media[0]?.url ?? null,
    createdAt: r.createdAt,
  }));

  if (filters.sort === "cost") {
    items.sort((a, b) => Number(b.totalCostMinor - a.totalCostMinor));
  }

  return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
}

/* ------------------------------------------------------------------ detail */

export async function getStone(id: string) {
  const s = await db.stone.findUnique({
    where: { id },
    include: {
      variety: true, shape: true, colour: true, treatment: true,
      location: true, heldBy: true, createdBy: { select: { name: true } },
      purchase: { include: { supplier: { select: { name: true } } } },
      costEntries: { orderBy: { incurredOn: "asc" } },
      custodyEvents: {
        orderBy: { occurredAt: "desc" },
        include: {
          toParty: { select: { name: true } },
          toLocation: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      },
      media: { orderBy: { isMain: "desc" } },
    },
  });
  if (!s) return null;

  const totalCostMinor = s.costEntries.reduce((sum, c) => sum + c.baseMinor, 0n);

  // Where this stone came from, and what it became — the genealogy that a
  // generic inventory system cannot express.
  const asOutput = await db.transformationLine.findFirst({
    where: { stoneId: id, direction: "output" },
    include: {
      transformation: {
        include: {
          lines: {
            where: { direction: "input" },
            include: { stone: { select: { id: true, stoneNo: true, weightCt: true } } },
          },
        },
      },
    },
  });

  const asInput = await db.transformationLine.findFirst({
    where: { stoneId: id, direction: "input" },
    include: {
      transformation: {
        include: {
          lines: {
            where: { direction: "output" },
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
      },
    },
  });

  return {
    ...s,
    weightCt: dec(s.weightCt)!,
    lengthMm: dec(s.lengthMm),
    widthMm: dec(s.widthMm),
    depthMm: dec(s.depthMm),
    totalCostMinor,
    costEntries: s.costEntries.map((c) => ({
      ...c,
      fxRate: dec(c.fxRate)!,
    })),
    custodyEvents: s.custodyEvents.map((e) => ({
      ...e,
      weightCt: dec(e.weightCt)!,
    })),
    purchase: s.purchase
      ? { ...s.purchase, weightCt: dec(s.purchase.weightCt)! }
      : null,
    parent: asOutput
      ? {
          transformationId: asOutput.transformationId,
          lossCt: dec(asOutput.transformation.lossCt)!,
          occurredAt: asOutput.transformation.occurredAt,
          costAllocMethod: asOutput.transformation.costAllocMethod,
          inputs: asOutput.transformation.lines.map((l) => ({
            id: l.stone.id,
            stoneNo: l.stone.stoneNo,
            weightCt: dec(l.stone.weightCt)!,
          })),
        }
      : null,
    children: asInput
      ? {
          occurredAt: asInput.transformation.occurredAt,
          lossCt: dec(asInput.transformation.lossCt)!,
          outputs: asInput.transformation.lines.map((l) => ({
            id: l.stone.id,
            stoneNo: l.stone.stoneNo,
            weightCt: dec(l.stone.weightCt)!,
            status: l.stone.status,
            variety: l.stone.variety?.name ?? null,
            colour: l.stone.colour?.name ?? null,
          })),
        }
      : null,
  };
}

export type StoneDetail = NonNullable<Awaited<ReturnType<typeof getStone>>>;

/* --------------------------------------------------------------- reference */

export async function getReferenceData() {
  const [varieties, shapes, colours, treatments, locations] = await Promise.all([
    db.refVariety.findMany({ orderBy: { sortKey: "asc" } }),
    db.refShape.findMany({ orderBy: { sortKey: "asc" } }),
    db.refColour.findMany({ orderBy: { sortKey: "asc" } }),
    db.refTreatment.findMany({ orderBy: { sortKey: "asc" } }),
    db.location.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { varieties, shapes, colours, treatments, locations };
}

/** Next stone number in a per-variety sequence, e.g. BS-2026-0042. */
export async function nextStoneNo(varietyName?: string | null): Promise<string> {
  const prefix = (varietyName ?? "ST").slice(0, 2).toUpperCase();
  const year = new Date().getFullYear();
  const last = await db.stone.findFirst({
    where: { stoneNo: { startsWith: `${prefix}-${year}-` } },
    orderBy: { stoneNo: "desc" },
    select: { stoneNo: true },
  });
  const n = last ? parseInt(last.stoneNo.split("-")[2], 10) + 1 : 1;
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}
