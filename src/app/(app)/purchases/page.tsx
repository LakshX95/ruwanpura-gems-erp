import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, EmptyState, Restricted } from "@/components/ui/primitives";
import { formatCt, formatDate, formatMoney, formatMoneyShort } from "@/lib/format";
import { Suspense } from "react";
import { PageActions } from "@/components/page-actions";
import { PrintHeader } from "@/components/print-header";

export default async function PurchasesPage() {
  const user = await requireUser();
  if (!can(user, "purchase:view")) {
    return (
      <Card>
        <EmptyState title="Purchases are not visible to your role." />
      </Card>
    );
  }

  const purchases = await db.purchase.findMany({
    orderBy: { purchasedOn: "desc" },
    include: {
      supplier: { select: { name: true } },
      _count: { select: { stones: true } },
    },
    take: 200,
  });

  const totalMinor = purchases.reduce((a, p) => a + p.totalMinor, 0n);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-lg font-semibold text-fg">Purchases</h1>
        <p className="text-sm text-fg-3">
          {purchases.length} purchase{purchases.length === 1 ? "" : "s"} ·{" "}
          {formatMoneyShort(totalMinor)} committed
        </p>
        </div>
        <Suspense fallback={null}>
          <PageActions dataset="purchases" />
        </Suspense>
      </div>

      <PrintHeader title="Purchase register" subtitle={`${purchases.length} purchases`} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-surface-2">
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-3">
                <th className="px-4 py-2 font-semibold">Reference</th>
                <th className="px-4 py-2 font-semibold">Date</th>
                <th className="px-4 py-2 font-semibold">Supplier</th>
                <th className="px-4 py-2 font-semibold">Description</th>
                <th className="px-4 py-2 font-semibold">Broker</th>
                <th className="px-4 py-2 text-right font-semibold">Weight</th>
                <th className="px-4 py-2 text-right font-semibold">Stones</th>
                <th className="px-4 py-2 text-right font-semibold">Cost</th>
                <th className="px-4 py-2 text-right font-semibold">Per carat</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => {
                const weight = Number(p.weightCt.toString());
                const perCt = weight
                  ? BigInt(Math.round(Number(p.totalMinor) / weight))
                  : null;
                return (
                  <tr key={p.id} className="border-b border-line-soft last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-1.5 font-medium text-fg">
                      {p.purchaseNo}
                    </td>
                    <td className="tnum px-4 py-1.5 text-fg-3">
                      {formatDate(p.purchasedOn)}
                    </td>
                    <td className="px-4 py-1.5 text-fg-2">{p.supplier.name}</td>
                    <td className="px-4 py-1.5 text-fg-2">{p.description ?? "—"}</td>
                    <td className="px-4 py-1.5 text-fg-3">{p.brokerName ?? "—"}</td>
                    <td className="tnum px-4 py-1.5 text-right text-fg-2">
                      {formatCt(weight)}
                    </td>
                    <td className="tnum px-4 py-1.5 text-right">
                      {p._count.stones > 0 ? (
                        <Link
                          href={`/stones?q=${encodeURIComponent(p.purchaseNo)}`}
                          className="text-accent hover:underline"
                        >
                          {p._count.stones}
                        </Link>
                      ) : (
                        <span className="text-fg-4">0</span>
                      )}
                    </td>
                    <td className="tnum px-4 py-1.5 text-right font-medium text-fg">
                      {formatMoney(p.totalMinor, p.currency)}
                    </td>
                    <td className="tnum px-4 py-1.5 text-right text-fg-3">
                      {perCt ? formatMoneyShort(perCt) : <Restricted />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
