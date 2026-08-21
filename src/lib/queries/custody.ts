import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export type OutItem = {
  id: string;
  stoneNo: string;
  variety: string | null;
  colour: string | null;
  weightCt: number;
  reason: string;
  sentOn: Date;
  expectedBack: Date | null;
  daysOut: number;
  daysOver: number | null;
  voucherNo: string | null;
  costMinor: bigint;
};

export type CustodyGroup = {
  party: string;
  partyId: string | null;
  items: OutItem[];
  totalCostMinor: bigint;
  overdueCount: number;
};

/**
 * Everything not in the safe, grouped by who is holding it.
 *
 * Custody and ownership are separate: all of this is still owned by the
 * business. The grouping is by holder because that is the question actually
 * being asked — "who has my stones, and for how long?"
 */
export async function getOutstandingCustody(): Promise<{
  groups: CustodyGroup[];
  totalItems: number;
  totalCostMinor: bigint;
  overdueCount: number;
}> {
  const rows = await db.$queryRaw<
    {
      id: string; stone_no: string; variety: string | null; colour: string | null;
      weight_ct: string; reason: string; occurred_at: Date; expected_back: Date | null;
      voucher_no: string | null; party_id: string | null; party: string | null;
      cost: bigint | null;
    }[]
  >(Prisma.sql`
    SELECT s.id, s.stone_no, v.name AS variety, col.name AS colour,
           s.weight_ct::text, e.reason::text, e.occurred_at, e.expected_back,
           e.voucher_no, e.to_party_id AS party_id, p.name AS party,
           COALESCE((SELECT sum(c.base_minor) FROM cost_entry c WHERE c.stone_id = s.id), 0)::bigint AS cost
    FROM stone s
    JOIN LATERAL (
      SELECT * FROM custody_event ce
      WHERE ce.stone_id = s.id ORDER BY ce.occurred_at DESC LIMIT 1
    ) e ON true
    LEFT JOIN party p ON p.id = e.to_party_id
    LEFT JOIN ref_variety v ON v.id = s.variety_id
    LEFT JOIN ref_colour col ON col.id = s.colour_id
    WHERE s.status = 'OUT'
    ORDER BY p.name NULLS LAST, e.occurred_at ASC
  `);

  const today = new Date();
  const byParty = new Map<string, CustodyGroup>();
  let totalCostMinor = 0n;
  let overdueCount = 0;

  for (const r of rows) {
    const key = r.party_id ?? "unassigned";
    const daysOut = Math.floor(
      (today.getTime() - new Date(r.occurred_at).getTime()) / 86_400_000,
    );
    const daysOver = r.expected_back
      ? Math.floor(
          (today.getTime() - new Date(r.expected_back).getTime()) / 86_400_000,
        )
      : null;
    const isOverdue = daysOver != null && daysOver > 0;
    if (isOverdue) overdueCount++;

    const cost = r.cost ?? 0n;
    totalCostMinor += cost;

    if (!byParty.has(key)) {
      byParty.set(key, {
        party: r.party ?? "Unassigned",
        partyId: r.party_id,
        items: [],
        totalCostMinor: 0n,
        overdueCount: 0,
      });
    }
    const g = byParty.get(key)!;
    g.items.push({
      id: r.id,
      stoneNo: r.stone_no,
      variety: r.variety,
      colour: r.colour,
      weightCt: Number(r.weight_ct),
      reason: r.reason,
      sentOn: r.occurred_at,
      expectedBack: r.expected_back,
      daysOut,
      daysOver: isOverdue ? daysOver : null,
      voucherNo: r.voucher_no,
      costMinor: cost,
    });
    g.totalCostMinor += cost;
    if (isOverdue) g.overdueCount++;
  }

  const groups = [...byParty.values()].sort(
    (a, b) => b.overdueCount - a.overdueCount || Number(b.totalCostMinor - a.totalCostMinor),
  );

  return { groups, totalItems: rows.length, totalCostMinor, overdueCount };
}
