import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { csvResponse, minorToDecimal, stamp, toCsv, type Column } from "@/lib/csv";
import { listStones, type StoneListItem, type StoneFilters } from "@/lib/queries/stones";
import { listJobs } from "@/lib/queries/jobs";
import { getOutstandingCustody } from "@/lib/queries/custody";
import { vendorPerformance } from "@/lib/queries/jobs";
import { listSales } from "@/lib/queries/sales";
import { listMemos } from "@/lib/queries/memos";
import { resolveRange } from "@/lib/date-range";
import type { StoneStatus } from "@/generated/prisma/enums";

/**
 * A single CSV of the whole registry, with costs, is the most valuable thing an
 * insider can walk out with. Every export is therefore permission-checked and
 * written to the audit log with the actor and the row count.
 */
async function recordExport(
  actorId: string,
  dataset: string,
  rows: number,
  withCost: boolean,
) {
  await db.auditLog.create({
    data: {
      tableName: "export",
      rowId: dataset,
      action: "export",
      actorId,
      changes: { dataset, rows, includedCost: withCost },
    },
  });
}

const num = (v: string | null) =>
  v && !Number.isNaN(Number(v)) ? Number(v) : undefined;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { dataset } = await params;
  const sp = new URL(request.url).searchParams;
  const withCost = can(user, "cost:view");
  // The export must match what the page shows, period filter included.
  const range = resolveRange(sp.get("period"), sp.get("from"), sp.get("to"));

  switch (dataset) {
    case "stones": {
      const filters: StoneFilters = {
        q: sp.get("q") ?? undefined,
        varietyId: sp.get("varietyId") ?? undefined,
        status: (sp.get("status") as StoneStatus) ?? undefined,
        treatmentId: sp.get("treatmentId") ?? undefined,
        locationId: sp.get("locationId") ?? undefined,
        minCt: num(sp.get("minCt")),
        maxCt: num(sp.get("maxCt")),
        page: 1,
        perPage: 10_000, // whole filtered set, not just the visible page
      };
      const { items } = await listStones(filters);
      const cols: Column<StoneListItem>[] = [
        { header: "Stone No", value: (r) => r.stoneNo },
        { header: "Type", value: (r) => r.kind },
        { header: "Status", value: (r) => r.status },
        { header: "Variety", value: (r) => r.variety },
        { header: "Shape", value: (r) => r.shape },
        { header: "Colour", value: (r) => r.colour },
        { header: "Treatment", value: (r) => r.treatment },
        { header: "Clarity", value: (r) => r.clarity },
        { header: "Weight (ct)", value: (r) => r.weightCt.toFixed(3) },
        { header: "Pieces", value: (r) => r.pieceCount },
        { header: "Certificate", value: (r) => r.certLab },
        { header: "Location", value: (r) => r.location },
        { header: "Held by", value: (r) => r.heldBy },
        { header: "Added", value: (r) => r.createdAt.toISOString().slice(0, 10) },
        ...(withCost
          ? [
              { header: "Landed cost", value: (r: StoneListItem) => minorToDecimal(r.totalCostMinor) },
              { header: "Asking price", value: (r: StoneListItem) => minorToDecimal(r.askingPriceMinor) },
              { header: "Currency", value: () => "LKR" },
            ]
          : []),
      ];
      await recordExport(user.id, dataset, items.length, withCost);
      return csvResponse(toCsv(items, cols), `stones-${stamp()}.csv`);
    }

    case "jobs": {
      const jobs = await listJobs({});
      const cols: Column<(typeof jobs)[number]>[] = [
        { header: "Job No", value: (r) => r.jobNo },
        { header: "Type", value: (r) => r.kind },
        { header: "Status", value: (r) => r.status },
        { header: "Vendor", value: (r) => r.vendor },
        { header: "Stones", value: (r) => r.stoneCount },
        { header: "Weight out (ct)", value: (r) => r.weightOutCt.toFixed(3) },
        { header: "Weight back (ct)", value: (r) => r.weightInCt?.toFixed(3) ?? "" },
        { header: "Yield %", value: (r) => r.yieldPct?.toFixed(1) ?? "" },
        { header: "Lost", value: (r) => r.lostCount },
        { header: "Issued", value: (r) => r.issuedOn.toISOString().slice(0, 10) },
        { header: "Expected back", value: (r) => r.expectedBack?.toISOString().slice(0, 10) ?? "" },
        { header: "Returned", value: (r) => r.returnedOn?.toISOString().slice(0, 10) ?? "" },
        { header: "Days overdue", value: (r) => r.overdueDays || "" },
        ...(withCost
          ? [{ header: "Charge", value: (r: (typeof jobs)[number]) => minorToDecimal(r.chargeMinor) }]
          : []),
      ];
      await recordExport(user.id, dataset, jobs.length, withCost);
      return csvResponse(toCsv(jobs, cols), `jobs-${stamp()}.csv`);
    }

    case "custody": {
      const { groups } = await getOutstandingCustody();
      const rows = groups.flatMap((g) =>
        g.items.map((i) => ({ ...i, party: g.party })),
      );
      const cols: Column<(typeof rows)[number]>[] = [
        { header: "Stone No", value: (r) => r.stoneNo },
        { header: "Variety", value: (r) => r.variety },
        { header: "Weight (ct)", value: (r) => r.weightCt.toFixed(3) },
        { header: "Held by", value: (r) => r.party },
        { header: "Reason", value: (r) => r.reason },
        { header: "Sent", value: (r) => new Date(r.sentOn).toISOString().slice(0, 10) },
        { header: "Due back", value: (r) => r.expectedBack ? new Date(r.expectedBack).toISOString().slice(0, 10) : "" },
        { header: "Days out", value: (r) => r.daysOut },
        { header: "Days overdue", value: (r) => r.daysOver ?? "" },
        { header: "Voucher", value: (r) => r.voucherNo },
        ...(withCost
          ? [{ header: "Cost", value: (r: (typeof rows)[number]) => minorToDecimal(r.costMinor) }]
          : []),
      ];
      await recordExport(user.id, dataset, rows.length, withCost);
      return csvResponse(toCsv(rows, cols), `where-is-it-${stamp()}.csv`);
    }

    case "purchases": {
      if (!can(user, "purchase:view")) {
        return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      }
      const purchases = await db.purchase.findMany({
        orderBy: { purchasedOn: "desc" },
        include: { supplier: { select: { name: true } }, _count: { select: { stones: true } } },
      });
      const cols: Column<(typeof purchases)[number]>[] = [
        { header: "Reference", value: (r) => r.purchaseNo },
        { header: "Date", value: (r) => r.purchasedOn.toISOString().slice(0, 10) },
        { header: "Supplier", value: (r) => r.supplier.name },
        { header: "Description", value: (r) => r.description },
        { header: "Broker", value: (r) => r.brokerName },
        { header: "Weight (ct)", value: (r) => Number(r.weightCt.toString()).toFixed(3) },
        { header: "Stones created", value: (r) => r._count.stones },
        { header: "Total", value: (r) => minorToDecimal(r.totalMinor) },
        { header: "Currency", value: (r) => r.currency },
      ];
      await recordExport(user.id, dataset, purchases.length, true);
      return csvResponse(toCsv(purchases, cols), `purchases-${stamp()}.csv`);
    }

    case "memos": {
      if (!can(user, "memo:view")) {
        return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      }
      const memos = await listMemos();
      const cols: Column<(typeof memos)[number]>[] = [
        { header: "Memo No", value: (r) => r.memoNo },
        { header: "Status", value: (r) => r.status },
        { header: "With", value: (r) => r.party },
        { header: "Issued", value: (r) => r.issuedOn.toISOString().slice(0, 10) },
        { header: "Due back", value: (r) => r.dueBack.toISOString().slice(0, 10) },
        { header: "Days out", value: (r) => r.daysOut },
        { header: "Days overdue", value: (r) => r.daysOverdue || "" },
        { header: "Stones out", value: (r) => r.openLines },
        { header: "Stones total", value: (r) => r.totalLines },
        { header: "Returned", value: (r) => r.returned },
        { header: "Sold", value: (r) => r.sold },
        { header: "Not returned", value: (r) => r.lost },
        { header: "Weight out (ct)", value: (r) => r.weightOutCt.toFixed(3) },
        { header: "Quoted (LKR)", value: (r) => minorToDecimal(r.quotedMinor) },
        { header: "Extended", value: (r) => (r.wasExtended ? "yes" : "") },
        ...(withCost
          ? [{ header: "Value out at cost (LKR)", value: (r: (typeof memos)[number]) => minorToDecimal(r.valueOutMinor) }]
          : []),
      ];
      await recordExport(user.id, dataset, memos.length, withCost);
      return csvResponse(toCsv(memos, cols), `memos-${stamp()}.csv`);
    }

    case "sales": {
      if (!can(user, "sale:view")) {
        return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      }
      const sales = await listSales(range);
      const showMargin = can(user, "margin:view");
      const cols: Column<(typeof sales)[number]>[] = [
        { header: "Sale No", value: (r) => r.saleNo },
        { header: "Date", value: (r) => r.soldOn.toISOString().slice(0, 10) },
        { header: "Customer", value: (r) => r.customer },
        { header: "Broker", value: (r) => r.brokerName },
        { header: "Stones", value: (r) => r.stoneCount },
        { header: "Weight (ct)", value: (r) => r.weightCt.toFixed(3) },
        { header: "Revenue (LKR)", value: (r) => minorToDecimal(r.revenueMinor) },
        ...(withCost
          ? [{ header: "Cost (LKR)", value: (r: (typeof sales)[number]) => minorToDecimal(r.costMinor) }]
          : []),
        ...(showMargin
          ? [
              { header: "Margin (LKR)", value: (r: (typeof sales)[number]) => minorToDecimal(r.marginMinor) },
              { header: "Margin %", value: (r: (typeof sales)[number]) => r.marginPct?.toFixed(1) ?? "" },
            ]
          : []),
      ];
      await recordExport(user.id, dataset, sales.length, withCost);
      return csvResponse(toCsv(sales, cols), `sales-${stamp()}.csv`);
    }

    case "vendor-performance": {
      if (!can(user, "reports:view")) {
        return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      }
      const rows = await vendorPerformance(range);
      const cols: Column<(typeof rows)[number]>[] = [
        { header: "Vendor", value: (r) => r.vendor },
        { header: "Work", value: (r) => r.kind },
        { header: "Jobs", value: (r) => Number(r.jobs) },
        { header: "Stones", value: (r) => Number(r.stones) },
        { header: "Weight out (ct)", value: (r) => Number(r.out_ct ?? 0).toFixed(3) },
        { header: "Weight back (ct)", value: (r) => Number(r.in_ct ?? 0).toFixed(3) },
        { header: "Yield %", value: (r) => r.yield_pct?.toFixed(1) ?? "" },
        { header: "Lost", value: (r) => Number(r.lost) },
        { header: "Avg days", value: (r) => r.avg_days?.toFixed(1) ?? "" },
        ...(withCost
          ? [{ header: "Charged", value: (r: (typeof rows)[number]) => minorToDecimal(r.charged ?? 0n) }]
          : []),
      ];
      await recordExport(user.id, dataset, rows.length, withCost);
      return csvResponse(toCsv(rows, cols), `vendor-performance-${stamp()}.csv`);
    }

    default:
      return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }
}
