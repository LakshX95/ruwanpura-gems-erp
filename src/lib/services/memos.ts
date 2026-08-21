import "server-only";
import { db } from "@/lib/db";
import { CustodyReason, MemoLineOutcome } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import { createSale } from "@/lib/services/sales";

/**
 * Memo — goods out on approval.
 *
 * The rule that matters: ownership never moves. Everything on a memo is still
 * the business's property and still on its books, so these stones stay in the
 * stock valuation and only their custody changes.
 */

export async function nextMemoNo(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.memo.findFirst({
    where: { memoNo: { startsWith: `MEMO-${year}-` } },
    orderBy: { memoNo: "desc" },
    select: { memoNo: true },
  });
  const n = last ? parseInt(last.memoNo.split("-")[2], 10) + 1 : 1;
  return `MEMO-${year}-${String(n).padStart(4, "0")}`;
}

export type IssueMemoInput = {
  partyId: string;
  stoneIds: string[];
  dueBack: Date;
  note?: string | null;
};

export async function issueMemo(input: IssueMemoInput, user: SessionUser) {
  if (input.stoneIds.length === 0) {
    throw new Error("Select at least one stone to send out on memo.");
  }

  const stones = await db.stone.findMany({
    where: { id: { in: input.stoneIds } },
    select: { id: true, stoneNo: true, status: true, weightCt: true, askingPriceMinor: true },
  });
  if (stones.length !== input.stoneIds.length) {
    throw new Error("One or more stones no longer exist.");
  }
  const notInSafe = stones.filter((s) => s.status !== "IN_STOCK");
  if (notInSafe.length) {
    throw new Error(`Not in the safe: ${notInSafe.map((s) => s.stoneNo).join(", ")}`);
  }

  const memoNo = await nextMemoNo();
  const issuedOn = new Date();

  return db.$transaction(async (tx) => {
    const memo = await tx.memo.create({
      data: {
        memoNo,
        partyId: input.partyId,
        issuedOn,
        dueBack: input.dueBack,
        note: input.note ?? null,
        createdById: user.id,
        lines: {
          create: stones.map((s) => ({
            stoneId: s.id,
            weightOutCt: s.weightCt,
            // The asking price at handover is the number the conversation is
            // about; it is snapshotted so a later reprice does not rewrite it.
            quotedPriceMinor: s.askingPriceMinor,
          })),
        },
      },
    });

    for (const s of stones) {
      await tx.stone.update({
        where: { id: s.id },
        data: { status: "OUT", heldById: input.partyId, locationId: null },
      });
      await tx.custodyEvent.create({
        data: {
          stoneId: s.id,
          reason: CustodyReason.MEMO,
          weightCt: s.weightCt,
          toPartyId: input.partyId,
          expectedBack: input.dueBack,
          voucherNo: memoNo,
          createdById: user.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        tableName: "memo",
        rowId: memo.id,
        action: "create",
        actorId: user.id,
        changes: { memoNo, stones: stones.length },
      },
    });

    return memo;
  });
}

export type SettleLine = {
  lineId: string;
  outcome: MemoLineOutcome | "KEEP";
  /** Required when the outcome is SOLD. */
  priceMinor?: bigint | null;
  note?: string | null;
};

/**
 * Settle some or all of a memo. Lines left as KEEP stay out, which is the
 * normal case — a dealer returns four of six and keeps two a while longer.
 */
export async function settleMemo(
  memoId: string,
  lines: SettleLine[],
  returnLocationId: string | null,
  user: SessionUser,
) {
  const memo = await db.memo.findUnique({
    where: { id: memoId },
    include: { lines: { include: { stone: { select: { stoneNo: true } } } } },
  });
  if (!memo) throw new Error("Memo not found.");
  if (memo.status !== "OPEN") throw new Error("This memo is already closed.");

  const byId = new Map(memo.lines.map((l) => [l.id, l]));
  const acting = lines.filter((l) => l.outcome !== "KEEP");
  for (const l of acting) {
    const line = byId.get(l.lineId);
    if (!line) throw new Error("Unknown memo line.");
    if (line.outcome) throw new Error(`${line.stone.stoneNo} is already settled.`);
    if (l.outcome === "SOLD" && (l.priceMinor == null || l.priceMinor <= 0n)) {
      throw new Error(`Enter the sale price for ${line.stone.stoneNo}.`);
    }
  }
  if (acting.length === 0) throw new Error("Nothing to settle.");

  const sold = acting.filter((l) => l.outcome === "SOLD");
  let saleId: string | null = null;

  // Selling from a memo produces a real sale, so margin and the sales register
  // stay complete rather than the stone quietly changing status.
  if (sold.length) {
    const sale = await createSale(
      {
        customerId: memo.partyId,
        soldOn: new Date(),
        currency: "LKR",
        fxRate: 1,
        note: `Converted from ${memo.memoNo}`,
        lines: sold.map((l) => ({
          stoneId: byId.get(l.lineId)!.stoneId,
          perCaratMinor: null,
          totalMinor: l.priceMinor!,
        })),
      },
      user,
    );
    saleId = sale.id;
  }

  await db.$transaction(async (tx) => {
    for (const l of acting) {
      const line = byId.get(l.lineId)!;
      await tx.memoLine.update({
        where: { id: l.lineId },
        data: {
          outcome: l.outcome as MemoLineOutcome,
          settledOn: new Date(),
          saleId: l.outcome === "SOLD" ? saleId : null,
          note: l.note ?? null,
        },
      });

      if (l.outcome === "RETURNED") {
        await tx.stone.update({
          where: { id: line.stoneId },
          data: { status: "IN_STOCK", heldById: null, locationId: returnLocationId },
        });
        await tx.custodyEvent.create({
          data: {
            stoneId: line.stoneId,
            reason: CustodyReason.RETURN,
            weightCt: line.weightOutCt,
            toLocationId: returnLocationId,
            voucherNo: memo.memoNo,
            createdById: user.id,
          },
        });
      } else if (l.outcome === "LOST") {
        await tx.stone.update({
          where: { id: line.stoneId },
          data: { status: "WRITTEN_OFF", heldById: null, locationId: null },
        });
        await tx.custodyEvent.create({
          data: {
            stoneId: line.stoneId,
            reason: CustodyReason.RETURN,
            weightCt: line.weightOutCt,
            note: `Not returned from ${memo.memoNo} — written off`,
            voucherNo: memo.memoNo,
            createdById: user.id,
          },
        });
      }
      // SOLD is already handled by createSale, which moved the stone.
    }

    // The memo closes only once nothing is still out on it.
    const remaining = await tx.memoLine.count({
      where: { memoId, outcome: null },
    });
    if (remaining === 0) {
      await tx.memo.update({
        where: { id: memoId },
        data: { status: "CLOSED", closedOn: new Date() },
      });
    }

    await tx.auditLog.create({
      data: {
        tableName: "memo",
        rowId: memoId,
        action: "update",
        actorId: user.id,
        changes: { settled: acting.length, remaining, saleId },
      },
    });
  });

  return { saleId };
}

export async function extendMemo(
  memoId: string,
  newDueBack: Date,
  reason: string,
  user: SessionUser,
) {
  const memo = await db.memo.findUnique({ where: { id: memoId } });
  if (!memo) throw new Error("Memo not found.");
  if (memo.status !== "OPEN") throw new Error("This memo is closed.");
  if (newDueBack <= memo.dueBack) {
    throw new Error("The new date must be later than the current due date.");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const entry = `${stamp}: ${memo.dueBack.toISOString().slice(0, 10)} → ${newDueBack
    .toISOString()
    .slice(0, 10)}${reason ? ` (${reason})` : ""}`;

  await db.$transaction([
    db.memo.update({
      where: { id: memoId },
      data: {
        dueBack: newDueBack,
        extensionNote: memo.extensionNote ? `${memo.extensionNote}\n${entry}` : entry,
      },
    }),
    db.auditLog.create({
      data: {
        tableName: "memo",
        rowId: memoId,
        action: "update",
        actorId: user.id,
        changes: { extendedTo: newDueBack.toISOString().slice(0, 10), reason },
      },
    }),
  ]);
}
