import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  CostKind, CustodyReason, JobKind, JobLineOutcome,
} from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";

/**
 * Issuing stones to a vendor and taking them back.
 *
 * Both operations are transactional on purpose: a stone marked OUT without a
 * custody record, or a weight change without a job line to explain it, is
 * exactly the gap that a dispute or a theft hides in.
 */

const CUSTODY_FOR: Record<JobKind, CustodyReason> = {
  CUTTING: CustodyReason.CUTTING,
  HEATING: CustodyReason.HEATING,
  LAB: CustodyReason.LAB,
};

const COST_FOR: Record<JobKind, CostKind> = {
  CUTTING: CostKind.CUTTING,
  HEATING: CostKind.HEATING,
  LAB: CostKind.LAB,
};

export const JOB_LABEL: Record<JobKind, string> = {
  CUTTING: "Cutting & polishing",
  HEATING: "Heat treatment",
  LAB: "Laboratory",
};

export async function nextJobNo(kind: JobKind): Promise<string> {
  const prefix = { CUTTING: "CUT", HEATING: "HEAT", LAB: "LAB" }[kind];
  const year = new Date().getFullYear();
  const last = await db.job.findFirst({
    where: { jobNo: { startsWith: `${prefix}-${year}-` } },
    orderBy: { jobNo: "desc" },
    select: { jobNo: true },
  });
  const n = last ? parseInt(last.jobNo.split("-")[2], 10) + 1 : 1;
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}

export type IssueJobInput = {
  kind: JobKind;
  vendorId: string;
  stoneIds: string[];
  expectedBack?: Date | null;
  chargeBasis: string;
  instructions?: string | null;
};

export async function issueJob(input: IssueJobInput, user: SessionUser) {
  if (input.stoneIds.length === 0) {
    throw new Error("Select at least one stone to send out.");
  }

  const stones = await db.stone.findMany({
    where: { id: { in: input.stoneIds } },
    select: { id: true, stoneNo: true, status: true, weightCt: true },
  });

  if (stones.length !== input.stoneIds.length) {
    throw new Error("One or more selected stones no longer exist.");
  }
  // A stone already with a cutter cannot also be at the lab. Catching this
  // here is what keeps the custody position trustworthy.
  const notAvailable = stones.filter((s) => s.status !== "IN_STOCK");
  if (notAvailable.length) {
    throw new Error(
      `Not in the safe: ${notAvailable.map((s) => s.stoneNo).join(", ")}`,
    );
  }

  const jobNo = await nextJobNo(input.kind);

  return db.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        jobNo,
        kind: input.kind,
        vendorId: input.vendorId,
        issuedOn: new Date(),
        expectedBack: input.expectedBack ?? null,
        chargeBasis: input.chargeBasis,
        instructions: input.instructions ?? null,
        createdById: user.id,
        lines: {
          create: stones.map((s) => ({
            stoneId: s.id,
            weightOutCt: s.weightCt,
          })),
        },
      },
    });

    for (const s of stones) {
      await tx.stone.update({
        where: { id: s.id },
        data: { status: "OUT", heldById: input.vendorId, locationId: null },
      });
      await tx.custodyEvent.create({
        data: {
          stoneId: s.id,
          reason: CUSTODY_FOR[input.kind],
          weightCt: s.weightCt,
          toPartyId: input.vendorId,
          expectedBack: input.expectedBack ?? null,
          voucherNo: jobNo,
          createdById: user.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        tableName: "job",
        rowId: job.id,
        action: "create",
        actorId: user.id,
        changes: { jobNo, kind: input.kind, stones: stones.length },
      },
    });

    return job;
  });
}

export type ReceiveLine = {
  lineId: string;
  weightInCt: number;
  outcome: JobLineOutcome;
  chargeMinor: bigint | null;
  note?: string | null;
};

export async function receiveJob(
  jobId: string,
  lines: ReceiveLine[],
  returnLocationId: string | null,
  user: SessionUser,
) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { lines: { include: { stone: { select: { id: true, stoneNo: true } } } } },
  });
  if (!job) throw new Error("Job not found.");
  if (job.status !== "OPEN") throw new Error("This job is already closed.");

  const byId = new Map(job.lines.map((l) => [l.id, l]));
  for (const l of lines) {
    if (!byId.has(l.lineId)) throw new Error("Unknown job line.");
    if (l.outcome === "RETURNED" || l.outcome === "REJECTED") {
      if (!(l.weightInCt > 0)) {
        throw new Error(
          `Enter the returned weight for ${byId.get(l.lineId)!.stone.stoneNo}.`,
        );
      }
      // Weight can fall sharply during cutting, but it cannot increase.
      const out = Number(byId.get(l.lineId)!.weightOutCt.toString());
      if (l.weightInCt > out + 0.0005) {
        throw new Error(
          `${byId.get(l.lineId)!.stone.stoneNo} came back heavier than it went out ` +
            `(${out.toFixed(3)} ct out, ${l.weightInCt.toFixed(3)} ct in). Check the scale.`,
        );
      }
    }
  }

  await db.$transaction(async (tx) => {
    for (const l of lines) {
      const line = byId.get(l.lineId)!;
      const lost = l.outcome === "LOST" || l.outcome === "BROKEN";

      await tx.jobLine.update({
        where: { id: l.lineId },
        data: {
          weightInCt: lost ? 0 : l.weightInCt,
          outcome: l.outcome,
          chargeMinor: l.chargeMinor,
          note: l.note ?? null,
        },
      });

      await tx.stone.update({
        where: { id: line.stoneId },
        data: lost
          ? { status: "WRITTEN_OFF", heldById: null, locationId: null }
          : {
              status: "IN_STOCK",
              heldById: null,
              locationId: returnLocationId,
              // Re-weighed on return. The original weight survives on the job
              // line, which is where the loss is accounted for.
              weightCt: new Prisma.Decimal(l.weightInCt),
            },
      });

      await tx.custodyEvent.create({
        data: {
          stoneId: line.stoneId,
          reason: CustodyReason.RETURN,
          weightCt: lost ? 0 : l.weightInCt,
          toLocationId: lost ? null : returnLocationId,
          voucherNo: job.jobNo,
          note: lost ? `Written off — ${l.outcome.toLowerCase()}` : null,
          createdById: user.id,
        },
      });

      // Vendors normally charge for a stone that was destroyed in treatment,
      // so the charge is posted regardless of outcome.
      if (l.chargeMinor && l.chargeMinor > 0n) {
        await tx.costEntry.create({
          data: {
            stoneId: line.stoneId,
            kind: COST_FOR[job.kind],
            amountMinor: l.chargeMinor,
            baseMinor: l.chargeMinor,
            currency: "LKR",
            incurredOn: new Date(),
            sourceDoc: job.jobNo,
            note: JOB_LABEL[job.kind],
          },
        });
      }
    }

    await tx.job.update({
      where: { id: jobId },
      data: { status: "CLOSED", returnedOn: new Date() },
    });

    await tx.auditLog.create({
      data: {
        tableName: "job",
        rowId: jobId,
        action: "update",
        actorId: user.id,
        changes: { closed: true, lines: lines.length },
      },
    });
  });
}
