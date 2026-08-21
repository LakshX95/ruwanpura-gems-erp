import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listMemos, memoExposure } from "@/lib/queries/memos";
import type { MemoStatus } from "@/generated/prisma/enums";
import { Badge, ButtonLink, Card, EmptyState, Restricted } from "@/components/ui/primitives";
import { PageActions } from "@/components/page-actions";
import { PrintHeader } from "@/components/print-header";
import { formatCt, formatDate, formatMoneyShort } from "@/lib/format";
import { MemoStatusBadge } from "./memo-bits";

const TABS: { label: string; value: string }[] = [
  { label: "Out now", value: "OPEN" },
  { label: "Closed", value: "CLOSED" },
  { label: "All", value: "ALL" },
];

export default async function MemosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!can(user, "memo:view")) {
    return (
      <Card>
        <EmptyState title="Memos are not visible to your role." />
      </Card>
    );
  }

  const sp = await searchParams;
  const raw = sp.status;
  const status = (Array.isArray(raw) ? raw[0] : raw) ?? "OPEN";

  const [memos, exposure] = await Promise.all([
    listMemos(status === "ALL" ? undefined : (status as MemoStatus)),
    memoExposure(),
  ]);
  const showCost = can(user, "cost:view");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Memo &amp; consignment</h1>
          <p className="text-sm text-fg-3">
            {exposure.stones} stone{exposure.stones === 1 ? "" : "s"} out on
            approval across {exposure.memos} memo
            {exposure.memos === 1 ? "" : "s"}
            {showCost && ` · ${formatMoneyShort(exposure.valueMinor)} at cost`}
            {exposure.overdueStones > 0 && (
              <span className="text-warn"> · {exposure.overdueStones} overdue</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <PageActions dataset="memos" />
          </Suspense>
          {can(user, "memo:create") && (
            <ButtonLink href="/memos/new">
              <Plus size={15} /> Send on memo
            </ButtonLink>
          )}
        </div>
      </div>

      <PrintHeader title="Memo register" subtitle={`${memos.length} memos`} />

      <div className="flex gap-1 print:hidden">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/memos?status=${t.value}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              status === t.value
                ? "bg-accent-soft text-accent"
                : "text-fg-3 hover:bg-surface-3 hover:text-fg"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        {memos.length === 0 ? (
          <EmptyState
            title="Nothing out on approval"
            hint="Sending goods on memo records what went out, to whom, and when it is due back — with a voucher to sign."
            action={
              can(user, "memo:create") ? (
                <ButtonLink href="/memos/new">
                  <Plus size={15} /> Send stones on memo
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-3">
                  <th className="px-3 py-2 font-semibold">Memo</th>
                  <th className="px-3 py-2 font-semibold">With</th>
                  <th className="px-3 py-2 text-right font-semibold">Out</th>
                  <th className="px-3 py-2 text-right font-semibold">Weight</th>
                  <th className="px-3 py-2 font-semibold">Issued</th>
                  <th className="px-3 py-2 font-semibold">Due back</th>
                  <th className="px-3 py-2 text-right font-semibold">Value at cost</th>
                  <th className="px-3 py-2 font-semibold">Settled</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {memos.map((m) => (
                  <tr
                    key={m.id}
                    className={`border-b border-line-soft last:border-0 hover:bg-surface-2 ${
                      m.daysOverdue > 0 ? "bg-warn-soft/70" : ""
                    }`}
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/memos/${m.id}`}
                        className="font-medium text-fg hover:text-accent hover:underline"
                      >
                        {m.memoNo}
                      </Link>
                      {m.wasExtended && (
                        <Badge tone="amber" className="ml-1.5">extended</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-fg-2">
                      {m.party}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {m.openLines}
                      <span className="text-fg-4">/{m.totalLines}</span>
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {m.weightOutCt > 0 ? formatCt(m.weightOutCt) : "—"}
                    </td>
                    <td className="tnum px-3 py-1.5 text-fg-3">
                      {formatDate(m.issuedOn)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-fg-3">
                      {formatDate(m.dueBack)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg">
                      {showCost ? (
                        m.valueOutMinor > 0n ? formatMoneyShort(m.valueOutMinor) : "—"
                      ) : (
                        <Restricted />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs text-fg-3">
                      {m.returned > 0 && <span>{m.returned} back </span>}
                      {m.sold > 0 && <span className="text-accent">{m.sold} sold </span>}
                      {m.lost > 0 && (
                        <span className="text-danger">
                          <AlertTriangle size={10} className="inline" /> {m.lost} lost
                        </span>
                      )}
                      {m.returned + m.sold + m.lost === 0 && "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <MemoStatusBadge status={m.status} daysOverdue={m.daysOverdue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-fg-4 print:hidden">
        Goods on memo are still owned by the business and still counted in stock
        valuation — only custody has moved.
      </p>
    </div>
  );
}
