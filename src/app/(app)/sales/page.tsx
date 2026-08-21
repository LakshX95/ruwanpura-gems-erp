import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listSales } from "@/lib/queries/sales";
import { ButtonLink, Card, EmptyState, Restricted } from "@/components/ui/primitives";
import { PageActions } from "@/components/page-actions";
import { PrintHeader } from "@/components/print-header";
import { formatCt, formatDate, formatMoneyShort } from "@/lib/format";
import { DateRangeFilter } from "@/components/date-range";
import { resolveRange } from "@/lib/date-range";

export default async function SalesPage({
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
  if (!can(user, "sale:view")) {
    return (
      <Card>
        <EmptyState title="Sales are not visible to your role." />
      </Card>
    );
  }

  const sales = await listSales(range);
  const showMargin = can(user, "margin:view");
  const showCost = can(user, "cost:view");

  const revenue = sales.reduce((a, s) => a + s.revenueMinor, 0n);
  const margin = sales.reduce((a, s) => a + s.marginMinor, 0n);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Sales</h1>
          <p className="text-sm text-fg-3">
            {range.label} · {sales.length} sale{sales.length === 1 ? "" : "s"} ·{" "}
            {formatMoneyShort(revenue)} revenue
            {showMargin && ` · ${formatMoneyShort(margin)} margin`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Suspense fallback={null}>
            <DateRangeFilter />
          </Suspense>
          <Suspense fallback={null}>
            <PageActions dataset="sales" />
          </Suspense>
          {can(user, "sale:create") && (
            <ButtonLink href="/sales/new">
              <Plus size={15} /> Record a sale
            </ButtonLink>
          )}
        </div>
      </div>

      <PrintHeader title="Sales register" subtitle={`${range.label} — ${sales.length} sales`} />

      <Card className="overflow-hidden">
        {sales.length === 0 ? (
          <EmptyState
            title="No sales recorded yet"
            hint="Recording a sale turns the cost you have been tracking into realised profit per stone."
            action={
              can(user, "sale:create") ? (
                <ButtonLink href="/sales/new">
                  <Plus size={15} /> Record the first sale
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-3">
                  <th className="px-3 py-2 font-semibold">Sale</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">Broker</th>
                  <th className="px-3 py-2 text-right font-semibold">Stones</th>
                  <th className="px-3 py-2 text-right font-semibold">Weight</th>
                  <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                  <th className="px-3 py-2 text-right font-semibold">Cost</th>
                  <th className="px-3 py-2 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-line-soft last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/sales/${s.id}`}
                        className="font-medium text-fg hover:text-accent hover:underline"
                      >
                        {s.saleNo}
                      </Link>
                    </td>
                    <td className="tnum px-3 py-1.5 text-fg-3">
                      {formatDate(s.soldOn)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-fg-2">
                      {s.customer}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-fg-3">
                      {s.brokerName ?? "—"}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {s.stoneCount}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {formatCt(s.weightCt)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right font-medium text-fg">
                      {formatMoneyShort(s.revenueMinor)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-3">
                      {showCost ? formatMoneyShort(s.costMinor) : <Restricted />}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right">
                      {!showMargin ? (
                        <Restricted />
                      ) : (
                        <span
                          className={
                            s.marginMinor >= 0n
                              ? "font-medium text-accent"
                              : "font-medium text-danger"
                          }
                        >
                          {formatMoneyShort(s.marginMinor)}
                          {s.marginPct != null && (
                            <span className="ml-1 text-xs font-normal text-fg-4">
                              {s.marginPct.toFixed(0)}%
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
