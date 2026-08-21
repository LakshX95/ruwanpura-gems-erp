import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSale } from "@/lib/queries/sales";
import { Card, CardHeader, Restricted } from "@/components/ui/primitives";
import { PrintHeader } from "@/components/print-header";
import { PrintButton } from "@/components/page-actions";
import { GemSwatch } from "@/components/gem";
import { formatCt, formatDate, formatMoney } from "@/lib/format";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-fg-3">{label}</dt>
      <dd className="text-right font-medium text-fg">{children}</dd>
    </div>
  );
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sale = await getSale(id);
  if (!sale) notFound();

  const showCost = can(user, "cost:view");
  const showMargin = can(user, "margin:view");

  const revenue = sale.lines.reduce((a, l) => a + l.baseMinor, 0n);
  const cost = sale.lines.reduce((a, l) => a + l.costAtSaleMinor, 0n);
  const margin = revenue - cost;
  const marginPct = revenue > 0n ? (Number(margin) / Number(revenue)) * 100 : 0;

  return (
    <div className="space-y-4">
      <Link
        href="/sales"
        className="inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg print:hidden"
      >
        <ArrowLeft size={14} /> All sales
      </Link>

      <PrintHeader title="Sale" subtitle={sale.saleNo} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-fg">{sale.saleNo}</h1>
          <p className="mt-0.5 text-sm text-fg-3">
            {sale.customer.name} · {formatDate(sale.soldOn)} ·{" "}
            {sale.lines.length} stone{sale.lines.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-start gap-4">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-4">
              Revenue
            </div>
            <div className="tnum text-xl font-semibold text-fg">
              {formatMoney(revenue)}
            </div>
            {showMargin && (
              <div className="tnum text-xs">
                <span className={margin >= 0n ? "text-accent" : "text-danger"}>
                  {formatMoney(margin)} margin · {marginPct.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Stones sold" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-4">
                  <th className="px-4 py-1.5 font-semibold">Stone</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Weight</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Per carat</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Price</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Cost</th>
                  <th className="px-4 py-1.5 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((l) => (
                  <tr key={l.id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-1.5">
                      <Link
                        href={`/stones/${l.stoneId}`}
                        className="group flex items-center gap-2 whitespace-nowrap"
                      >
                        <GemSwatch colour={l.colour} variety={l.variety} size={20} />
                        <span className="font-medium text-fg group-hover:text-accent group-hover:underline">
                          {l.stoneNo}
                        </span>
                        <span className="text-xs text-fg-4">{l.variety}</span>
                      </Link>
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {l.weightCt.toFixed(3)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-3">
                      {formatMoney(l.perCaratMinor, sale.currency)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right font-medium text-fg">
                      {formatMoney(l.totalMinor, sale.currency)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-3">
                      {showCost ? formatMoney(l.costAtSaleMinor) : <Restricted />}
                    </td>
                    <td className="tnum px-4 py-1.5 text-right">
                      {!showMargin ? (
                        <Restricted />
                      ) : (
                        <span
                          className={
                            l.marginMinor >= 0n ? "text-accent" : "text-danger"
                          }
                        >
                          {formatMoney(l.marginMinor)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2 font-semibold">
                  <td className="px-4 py-2 text-fg-2">Total</td>
                  <td className="tnum px-3 py-2 text-right text-fg">
                    {formatCt(sale.lines.reduce((a, l) => a + l.weightCt, 0))}
                  </td>
                  <td />
                  <td className="tnum px-3 py-2 text-right text-fg">
                    {formatMoney(revenue)}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-fg-3">
                    {showCost ? formatMoney(cost) : <Restricted />}
                  </td>
                  <td className="tnum px-4 py-2 text-right">
                    {showMargin ? (
                      <span className={margin >= 0n ? "text-accent" : "text-danger"}>
                        {formatMoney(margin)}
                      </span>
                    ) : (
                      <Restricted />
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Details" />
          <dl className="divide-y divide-line-soft px-4 py-1 text-sm">
            <Row label="Customer">{sale.customer.name}</Row>
            {sale.customer.phone && <Row label="Phone">{sale.customer.phone}</Row>}
            <Row label="Date">{formatDate(sale.soldOn)}</Row>
            <Row label="Currency">{sale.currency}</Row>
            {sale.currency !== "LKR" && (
              <Row label="Rate used">
                <span className="tnum">{sale.fxRate}</span>
              </Row>
            )}
            {sale.brokerName && <Row label="Broker">{sale.brokerName}</Row>}
            <Row label="Recorded by">{sale.createdBy.name}</Row>
            {sale.note && <Row label="Note">{sale.note}</Row>}
          </dl>
        </Card>
      </div>
    </div>
  );
}
