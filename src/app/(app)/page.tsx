import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDashboard } from "@/lib/queries/dashboard";
import { Badge, Card, CardHeader, Restricted } from "@/components/ui/primitives";
import { GemSwatch, StatusBadge } from "@/components/gem";
import { formatCt, formatDate, formatMoneyShort } from "@/lib/format";

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "warn";
}) {
  return (
    <Card className="px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-4">
        {label}
      </div>
      <div
        className={`tnum mt-1 text-xl font-semibold ${
          tone === "warn" ? "text-warn" : "text-fg"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-fg-4">{sub}</div>}
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const d = await getDashboard();
  const showCost = can(user, "cost:view");
  const maxAging = Math.max(...d.aging.map((a) => Number(a.costMinor)), 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-fg">
          Good day, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-fg-3">
          {d.inStockCount.toLocaleString()} stones in the safe ·{" "}
          {formatCt(d.totalWeightCt)} held in total
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="In stock"
          value={d.inStockCount.toLocaleString()}
          sub={`${d.lotCount} unsorted parcels`}
        />
        <Stat
          label="Capital in stock"
          value={showCost ? formatMoneyShort(d.heldCostMinor) : <Restricted />}
          sub={showCost ? "at landed cost" : "restricted"}
        />
        <Stat
          label="Out of the safe"
          value={d.outCount.toLocaleString()}
          sub={
            showCost
              ? `${formatMoneyShort(d.outCostMinor)} at cost · ${d.openJobs} open jobs`
              : `${d.openJobs} open jobs`
          }
        />
        <Stat
          label="Overdue back"
          value={d.overdueCount.toLocaleString()}
          sub="past expected return"
          tone={d.overdueCount > 0 ? "warn" : undefined}
        />
        <Stat
          label="Out on memo"
          value={d.memo.stones.toLocaleString()}
          sub={
            showCost
              ? `${formatMoneyShort(d.memo.valueMinor)} at cost · ${d.memo.memos} memos`
              : `${d.memo.memos} memos`
          }
          tone={d.memo.overdueStones > 0 ? "warn" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Overdue is the money-losing list, so it leads. */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                {d.overdueCount > 0 && (
                  <AlertTriangle size={14} className="text-warn" />
                )}
                Overdue returns
              </span>
            }
            action={
              <Link href="/custody" className="text-xs font-medium text-accent hover:underline">
                Where is everything →
              </Link>
            }
          />
          {d.overdue.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fg-4">
              Nothing is overdue. Everything sent out is still within its expected return date.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-4">
                  <th className="px-4 py-1.5 font-semibold">Stone</th>
                  <th className="px-4 py-1.5 font-semibold">With</th>
                  <th className="px-4 py-1.5 font-semibold">Due back</th>
                  <th className="px-4 py-1.5 text-right font-semibold">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {d.overdue.map((o) => (
                  <tr key={o.id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-1.5">
                      <Link
                        href={`/stones/${o.id}`}
                        className="font-medium text-fg hover:text-accent hover:underline"
                      >
                        {o.stoneNo}
                      </Link>
                    </td>
                    <td className="px-4 py-1.5 text-fg-2">{o.party ?? "—"}</td>
                    <td className="tnum px-4 py-1.5 text-fg-2">
                      {formatDate(o.expectedBack)}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <Badge tone={o.daysOver > 30 ? "red" : "amber"}>
                        {o.daysOver} days
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="Recently added" />
          <ul className="divide-y divide-line-soft">
            {d.recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/stones/${r.id}`}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-2"
                >
                  <GemSwatch colour={r.colour} variety={r.variety} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-fg">
                      {r.stoneNo}
                    </div>
                    <div className="truncate text-xs text-fg-4">
                      {r.variety ?? "—"} · {formatCt(r.weightCt)}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Capital by age" />
          <div className="space-y-2.5 px-4 py-3">
            {d.aging.map((a) => (
              <div key={a.bucket}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-fg-2">{a.bucket}</span>
                  <span className="tnum text-fg-3">
                    {a.count} stones
                    {showCost && ` · ${formatMoneyShort(a.costMinor)}`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full ${
                      a.bucket === "Over 2 years" || a.bucket === "1-2 years"
                        ? "bg-warn"
                        : "bg-accent-hover"
                    }`}
                    style={{
                      width: `${Math.max(2, (Number(a.costMinor) / maxAging) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="border-t border-line-soft px-4 py-2 text-xs text-fg-4">
            Stock older than two years is capital that is not working.
          </p>
        </Card>

        <Card>
          <CardHeader title="Holdings by variety" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-4">
                <th className="px-4 py-1.5 font-semibold">Variety</th>
                <th className="px-4 py-1.5 text-right font-semibold">Stones</th>
                <th className="px-4 py-1.5 text-right font-semibold">Weight</th>
                <th className="px-4 py-1.5 text-right font-semibold">At cost</th>
              </tr>
            </thead>
            <tbody>
              {d.byVariety.map((v) => (
                <tr key={v.name} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-1.5 font-medium text-fg">{v.name}</td>
                  <td className="tnum px-4 py-1.5 text-right text-fg-2">{v.count}</td>
                  <td className="tnum px-4 py-1.5 text-right text-fg-2">
                    {v.weightCt.toFixed(2)}
                  </td>
                  <td className="tnum px-4 py-1.5 text-right text-fg">
                    {showCost ? formatMoneyShort(v.costMinor) : <Restricted />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
