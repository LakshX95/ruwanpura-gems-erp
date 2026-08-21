import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getOutstandingCustody } from "@/lib/queries/custody";
import { Badge, Card, CardHeader, EmptyState, Restricted } from "@/components/ui/primitives";
import { GemSwatch } from "@/components/gem";
import { formatCt, formatDate, formatMoneyShort } from "@/lib/format";
import { Suspense } from "react";
import { PageActions } from "@/components/page-actions";
import { PrintHeader } from "@/components/print-header";

const REASON_LABEL: Record<string, string> = {
  CUTTING: "Cutting",
  HEATING: "Heat treatment",
  LAB: "Laboratory",
  MEMO: "On memo",
  SHOW: "Trade show",
  INTERNAL_MOVE: "Moved",
  RECEIPT: "Received",
  RETURN: "Returned",
  SALE: "Sold",
};

export default async function CustodyPage() {
  const user = await requireUser();
  const { groups, totalItems, totalCostMinor, overdueCount } =
    await getOutstandingCustody();
  const showCost = can(user, "cost:view");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-lg font-semibold text-fg">Where is everything</h1>
        <p className="text-sm text-fg-3">
          {totalItems} item{totalItems === 1 ? "" : "s"} outside the safe
          {showCost && ` · ${formatMoneyShort(totalCostMinor)} at cost`}
          {overdueCount > 0 && (
            <span className="text-warn"> · {overdueCount} overdue</span>
          )}
        </p>
        </div>
        <Suspense fallback={null}>
          <PageActions dataset="custody" />
        </Suspense>
      </div>

      <PrintHeader title="Where is everything" subtitle={`${totalItems} items out${overdueCount ? `, ${overdueCount} overdue` : ""}`} />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title="Everything is in the safe"
            hint="Nothing is currently out with a cutter, heater, laboratory or buyer."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.partyId ?? "unassigned"}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {g.party}
                    <Badge tone="neutral">{g.items.length}</Badge>
                    {g.overdueCount > 0 && (
                      <Badge tone="amber">
                        <AlertTriangle size={11} className="mr-1" />
                        {g.overdueCount} overdue
                      </Badge>
                    )}
                  </span>
                }
                action={
                  showCost ? (
                    <span className="tnum text-xs text-fg-3">
                      {formatMoneyShort(g.totalCostMinor)} at cost
                    </span>
                  ) : null
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-4">
                      <th className="px-4 py-1.5 font-semibold">Stone</th>
                      <th className="px-4 py-1.5 text-right font-semibold">Weight</th>
                      <th className="px-4 py-1.5 font-semibold">For</th>
                      <th className="px-4 py-1.5 font-semibold">Sent</th>
                      <th className="px-4 py-1.5 font-semibold">Due back</th>
                      <th className="px-4 py-1.5 text-right font-semibold">Days out</th>
                      <th className="px-4 py-1.5 text-right font-semibold">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((i) => (
                      <tr
                        key={i.id}
                        className={`border-b border-line-soft last:border-0 ${
                          i.daysOver ? "bg-warn-soft/70" : ""
                        }`}
                      >
                        <td className="px-4 py-1.5">
                          <Link
                            href={`/stones/${i.id}`}
                            className="group flex items-center gap-2"
                          >
                            <GemSwatch colour={i.colour} variety={i.variety} size={22} />
                            <span className="font-medium text-fg group-hover:text-accent group-hover:underline">
                              {i.stoneNo}
                            </span>
                            <span className="text-xs text-fg-4">{i.variety}</span>
                          </Link>
                        </td>
                        <td className="tnum px-4 py-1.5 text-right text-fg-2">
                          {formatCt(i.weightCt)}
                        </td>
                        <td className="px-4 py-1.5 text-fg-2">
                          {REASON_LABEL[i.reason] ?? i.reason}
                        </td>
                        <td className="tnum px-4 py-1.5 text-fg-3">
                          {formatDate(i.sentOn)}
                        </td>
                        <td className="tnum px-4 py-1.5 text-fg-3">
                          {formatDate(i.expectedBack)}
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          {i.daysOver ? (
                            <Badge tone={i.daysOver > 30 ? "red" : "amber"}>
                              {i.daysOut}d · {i.daysOver} over
                            </Badge>
                          ) : (
                            <span className="tnum text-fg-3">{i.daysOut}d</span>
                          )}
                        </td>
                        <td className="tnum px-4 py-1.5 text-right text-fg-2">
                          {showCost ? formatMoneyShort(i.costMinor) : <Restricted />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
