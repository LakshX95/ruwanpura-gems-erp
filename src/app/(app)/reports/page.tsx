import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { Badge, Card, CardHeader, EmptyState, Restricted } from "@/components/ui/primitives";
import { vendorPerformance } from "@/lib/queries/jobs";
import { marginExtremes, salesSummary } from "@/lib/queries/sales";
import { DateRangeFilter } from "@/components/date-range";
import { resolveRange } from "@/lib/date-range";
import { JOB_KIND_LABEL } from "../jobs/job-bits";
import type { JobKind } from "@/generated/prisma/enums";
import { formatCt, formatDate, formatMoney, formatMoneyShort } from "@/lib/format";
import { Suspense } from "react";
import { PageActions } from "@/components/page-actions";
import { PrintHeader } from "@/components/print-header";

type SummaryRow = { name: string; n: bigint; weight: string; cost: bigint | null };

function SummaryTable({
  title,
  firstCol,
  rows,
  showCost,
  countLabel = "Stones",
}: {
  title: string;
  firstCol: string;
  rows: SummaryRow[];
  showCost: boolean;
  countLabel?: string;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-4">
            <th className="px-4 py-1.5 font-semibold">{firstCol}</th>
            <th className="px-4 py-1.5 text-right font-semibold">{countLabel}</th>
            <th className="px-4 py-1.5 text-right font-semibold">Weight</th>
            <th className="px-4 py-1.5 text-right font-semibold">At cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-line-soft last:border-0">
              <td className="px-4 py-1.5 font-medium text-fg">{r.name}</td>
              <td className="tnum px-4 py-1.5 text-right text-fg-2">{Number(r.n)}</td>
              <td className="tnum px-4 py-1.5 text-right text-fg-2">
                {Number(r.weight ?? 0).toFixed(2)}
              </td>
              <td className="tnum px-4 py-1.5 text-right text-fg">
                {showCost ? formatMoneyShort(r.cost ?? 0n) : <Restricted />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/**
 * Four reports. Sales margin follows once sales entry lands, because margin
 * needs a realised price rather than an asking price.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const range = resolveRange(one("period"), one("from"), one("to"));
  if (!can(user, "reports:view")) {
    return (
      <Card>
        <EmptyState title="Reports are not visible to your role." />
      </Card>
    );
  }
  const showCost = can(user, "cost:view");

  const [byLocation, byTreatment, lotOutcome, vendors, sales, extremes] = await Promise.all([
    db.$queryRaw<{ name: string; n: bigint; weight: string; cost: bigint | null }[]>(
      Prisma.sql`
        SELECT COALESCE(l.name, 'Unassigned') AS name,
               count(*)::bigint AS n,
               sum(s.weight_ct)::text AS weight,
               sum(COALESCE((SELECT sum(c.base_minor) FROM cost_entry c WHERE c.stone_id = s.id),0))::bigint AS cost
        FROM stone s
        LEFT JOIN location l ON l.id = s.location_id
        WHERE s.status = 'IN_STOCK'
        GROUP BY l.name
        ORDER BY cost DESC NULLS LAST
      `,
    ),
    db.$queryRaw<{ name: string; n: bigint; weight: string; cost: bigint | null }[]>(
      Prisma.sql`
        SELECT COALESCE(t.name, 'Not recorded') AS name,
               count(*)::bigint AS n,
               sum(s.weight_ct)::text AS weight,
               sum(COALESCE((SELECT sum(c.base_minor) FROM cost_entry c WHERE c.stone_id = s.id),0))::bigint AS cost
        FROM stone s
        LEFT JOIN ref_treatment t ON t.id = s.treatment_id
        WHERE s.status IN ('IN_STOCK','OUT') AND s.kind = 'STONE'
        GROUP BY t.name
        ORDER BY n DESC
      `,
    ),
    // What each sorted parcel actually produced: rough in, polished out, yield.
    db.$queryRaw<
      {
        lot_no: string; rough: string; polished: string | null; loss: string;
        children: bigint; lot_cost: bigint | null;
      }[]
    >(Prisma.sql`
      SELECT parent.stone_no AS lot_no,
             tin.weight_ct::text AS rough,
             sum(tout.weight_ct)::text AS polished,
             t.loss_ct::text AS loss,
             count(tout.id)::bigint AS children,
             COALESCE((SELECT sum(c.base_minor) FROM cost_entry c WHERE c.stone_id = parent.id),0)::bigint AS lot_cost
      FROM transformation t
      JOIN transformation_line tin  ON tin.transformation_id  = t.id AND tin.direction  = 'input'
      JOIN transformation_line tout ON tout.transformation_id = t.id AND tout.direction = 'output'
      JOIN stone parent ON parent.id = tin.stone_id
      WHERE TRUE
        ${range.from ? Prisma.sql`AND t.occurred_at >= ${range.from}` : Prisma.empty}
        ${range.to ? Prisma.sql`AND t.occurred_at <= ${range.to}` : Prisma.empty}
      GROUP BY parent.stone_no, parent.id, tin.weight_ct, t.loss_ct
      ORDER BY parent.stone_no
    `),
    vendorPerformance(range),
    salesSummary(range),
    marginExtremes(range),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-lg font-semibold text-fg">Reports</h1>
        <p className="text-sm text-fg-3">
          Vendor performance, stock position, treatment mix, and what each sorted
          parcel produced.
        </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Suspense fallback={null}>
            <DateRangeFilter />
          </Suspense>
          <Suspense fallback={null}>
            <PageActions dataset="vendor-performance" />
          </Suspense>
        </div>
      </div>

      <PrintHeader title="Reports" subtitle={range.label} />

      {can(user, "sale:view") && (
        <Card>
          <CardHeader
            title={`Sales & margin — ${range.label}`}
            action={
              <span className="text-xs text-fg-4">
                Realised profit, not asking prices
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-5">
            {[
              { label: "Sales", value: sales.sales.toLocaleString() },
              { label: "Stones sold", value: sales.stones.toLocaleString() },
              { label: "Weight", value: formatCt(sales.weightCt) },
              {
                label: "Revenue",
                value: showCost ? formatMoneyShort(sales.revenueMinor) : "—",
              },
              {
                label: "Margin",
                value: can(user, "margin:view")
                  ? `${formatMoneyShort(sales.marginMinor)}${
                      sales.marginPct != null ? ` · ${sales.marginPct.toFixed(0)}%` : ""
                    }`
                  : "—",
                tone: sales.marginMinor >= 0n ? "good" : "bad",
              },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-4">
                  {s.label}
                </div>
                <div
                  className={`tnum mt-1 text-lg font-semibold ${
                    s.tone === "bad" ? "text-danger" : s.tone === "good" ? "text-accent" : "text-fg"
                  }`}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {can(user, "margin:view") && extremes.best.length > 0 && (
            <div className="grid gap-px border-t border-line bg-line lg:grid-cols-2">
              {[
                { title: "Best deals", rows: extremes.best },
                { title: "Worst deals", rows: extremes.worst },
              ].map((block) => (
                <div key={block.title} className="bg-surface">
                  <div className="border-b border-line-soft px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-fg-4">
                    {block.title}
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {block.rows.map((r) => (
                        <tr key={r.stoneId + r.saleNo} className="border-b border-line-soft last:border-0">
                          <td className="px-4 py-1.5 font-medium text-fg">{r.stoneNo}</td>
                          <td className="px-2 py-1.5 text-xs text-fg-4">{r.variety}</td>
                          <td className="px-2 py-1.5 text-xs text-fg-4">{r.customer}</td>
                          <td className="tnum px-2 py-1.5 text-xs text-fg-4">
                            {formatDate(r.soldOn)}
                          </td>
                          <td className="tnum px-4 py-1.5 text-right">
                            <span
                              className={
                                r.marginMinor >= 0n
                                  ? "font-medium text-accent"
                                  : "font-medium text-danger"
                              }
                            >
                              {formatMoneyShort(r.marginMinor)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}


      <Card>
        <CardHeader
          title={`Vendor performance — ${range.label}`}
        />
        {vendors.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-fg-4">
            No completed jobs yet. Send stones out and receive them back, and
            this fills in.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-4">
                  <th className="px-4 py-1.5 font-semibold">Vendor</th>
                  <th className="px-3 py-1.5 font-semibold">Work</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Jobs</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Stones</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Out</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Back</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Yield</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Lost</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Avg days</th>
                  <th className="px-4 py-1.5 text-right font-semibold">Charged</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => {
                  const y = v.yield_pct;
                  const lost = Number(v.lost);
                  return (
                    <tr key={v.vendor + v.kind} className="border-b border-line-soft last:border-0">
                      <td className="px-4 py-1.5 font-medium text-fg">{v.vendor}</td>
                      <td className="px-3 py-1.5 text-fg-3">
                        {JOB_KIND_LABEL[v.kind as JobKind] ?? v.kind}
                      </td>
                      <td className="tnum px-3 py-1.5 text-right text-fg-2">{Number(v.jobs)}</td>
                      <td className="tnum px-3 py-1.5 text-right text-fg-2">{Number(v.stones)}</td>
                      <td className="tnum px-3 py-1.5 text-right text-fg-2">
                        {Number(v.out_ct ?? 0).toFixed(2)}
                      </td>
                      <td className="tnum px-3 py-1.5 text-right text-fg-2">
                        {Number(v.in_ct ?? 0).toFixed(2)}
                      </td>
                      <td className="tnum px-3 py-1.5 text-right">
                        {y == null ? (
                          <span className="text-fg-5">—</span>
                        ) : (
                          <span
                            className={
                              y >= 80
                                ? "font-medium text-accent"
                                : y >= 65
                                  ? "text-fg"
                                  : "font-medium text-warn"
                            }
                          >
                            {y.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {lost > 0 ? (
                          <Badge tone="red">{lost}</Badge>
                        ) : (
                          <span className="tnum text-fg-4">0</span>
                        )}
                      </td>
                      <td className="tnum px-3 py-1.5 text-right text-fg-2">
                        {v.avg_days == null ? "—" : v.avg_days.toFixed(0)}
                      </td>
                      <td className="tnum px-4 py-1.5 text-right text-fg">
                        {showCost ? formatMoneyShort(v.charged ?? 0n) : <Restricted />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line-soft px-4 py-2 text-xs text-fg-4">
          Yield is weight returned as a percentage of weight sent out, across all
          closed jobs. For heat treatment, the number that matters is the lost
          column.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryTable
          title="Stock on hand by location (as at today)"
          firstCol="Location"
          rows={byLocation}
          showCost={showCost}
          countLabel="Items"
        />
        <SummaryTable
          title="Holdings by treatment (as at today)"
          firstCol="Treatment"
          rows={byTreatment}
          showCost={showCost}
        />
      </div>

      <Card>
        <CardHeader title="Parcel yield — rough in, polished out" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-4">
                <th className="px-4 py-1.5 font-semibold">Parcel</th>
                <th className="px-4 py-1.5 text-right font-semibold">Rough</th>
                <th className="px-4 py-1.5 text-right font-semibold">Polished</th>
                <th className="px-4 py-1.5 text-right font-semibold">Lost</th>
                <th className="px-4 py-1.5 text-right font-semibold">Yield</th>
                <th className="px-4 py-1.5 text-right font-semibold">Stones</th>
                <th className="px-4 py-1.5 text-right font-semibold">Parcel cost</th>
              </tr>
            </thead>
            <tbody>
              {lotOutcome.map((r) => {
                const rough = Number(r.rough);
                const polished = Number(r.polished ?? 0);
                const yieldPct = rough ? (polished / rough) * 100 : 0;
                return (
                  <tr key={r.lot_no} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-1.5 font-medium text-fg">{r.lot_no}</td>
                    <td className="tnum px-4 py-1.5 text-right text-fg-2">
                      {formatCt(rough)}
                    </td>
                    <td className="tnum px-4 py-1.5 text-right text-fg-2">
                      {formatCt(polished)}
                    </td>
                    <td className="tnum px-4 py-1.5 text-right text-fg-4">
                      {formatCt(Number(r.loss))}
                    </td>
                    <td className="tnum px-4 py-1.5 text-right">
                      <span
                        className={
                          yieldPct >= 30
                            ? "font-medium text-accent"
                            : yieldPct >= 22
                              ? "text-fg-2"
                              : "font-medium text-warn"
                        }
                      >
                        {yieldPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="tnum px-4 py-1.5 text-right text-fg-2">
                      {Number(r.children)}
                    </td>
                    <td className="tnum px-4 py-1.5 text-right text-fg">
                      {showCost ? formatMoney(r.lot_cost ?? 0n) : <Restricted />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line-soft px-4 py-2 text-xs text-fg-4">
          Yield is polished weight as a percentage of rough. Once cutting jobs
          record which cutter did the work, this breaks down per cutter.
        </p>
      </Card>
    </div>
  );
}
