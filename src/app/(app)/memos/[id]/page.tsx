import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getMemo } from "@/lib/queries/memos";
import { Card, CardHeader, Restricted } from "@/components/ui/primitives";
import { PrintButton } from "@/components/page-actions";
import { GemSwatch } from "@/components/gem";
import { formatCt, formatDate, formatMoney, formatMoneyShort } from "@/lib/format";
import { MemoOutcomeBadge, MemoStatusBadge } from "../memo-bits";
import { SettleMemoForm } from "./settle-form";
import { ExtendMemoForm } from "./extend-form";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-fg-3">{label}</dt>
      <dd className="text-right font-medium text-fg">{children}</dd>
    </div>
  );
}

export default async function MemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "memo:view")) notFound();

  const { id } = await params;
  const memo = await getMemo(id);
  if (!memo) notFound();

  const showCost = can(user, "cost:view");
  const canSettle = can(user, "memo:create");
  const locations = await db.location.findMany({ orderBy: { name: "asc" } });

  const open = memo.lines.filter((l) => l.outcome === null);
  const valueOut = open.reduce((a, l) => a + l.costMinor, 0n);
  const quotedOut = open.reduce((a, l) => a + (l.quotedPriceMinor ?? 0n), 0n);

  return (
    <div className="space-y-4">
      <Link
        href="/memos"
        className="inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg print:hidden"
      >
        <ArrowLeft size={14} /> All memos
      </Link>

      {/* ---------------------------------------------- printed voucher head */}
      <div className="print-only mb-3 border-b border-line pb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-base font-semibold text-fg">
            Ruwanpura Gems — Memorandum of goods on approval
          </h1>
          <span className="text-xs text-fg-3">{memo.memoNo}</span>
        </div>
        <p className="mt-1 text-sm text-fg-2">
          Delivered to <strong>{memo.party.name}</strong> on{" "}
          {formatDate(memo.issuedOn)} · due back {formatDate(memo.dueBack)}
        </p>
        <p className="mt-1 text-xs text-fg-3">
          The goods listed below remain the property of the sender and are held
          on approval only. They must be returned in full on demand, or by the
          due date shown, unless purchased.
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-fg">{memo.memoNo}</h1>
            <MemoStatusBadge status={memo.status} daysOverdue={memo.daysOverdue} />
          </div>
          <p className="mt-0.5 text-sm text-fg-3">
            {memo.party.name} · {open.length} of {memo.lines.length} still out ·
            issued {formatDate(memo.issuedOn)}
          </p>
        </div>
        <div className="flex items-start gap-4">
          {open.length > 0 && (
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-4">
                Value out
              </div>
              <div className="tnum text-xl font-semibold text-fg">
                {showCost ? formatMoneyShort(valueOut) : <Restricted />}
              </div>
              <div className="tnum text-xs text-fg-4">
                {formatMoneyShort(quotedOut)} quoted
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {canSettle && memo.status === "OPEN" && <ExtendMemoForm memoId={memo.id} />}
            <PrintButton label="Print voucher" />
          </div>
        </div>
      </div>

      {canSettle && memo.status === "OPEN" && (
        <div className="print:hidden">
          <SettleMemoForm memo={memo} locations={locations} showCost={showCost} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Goods on this memo" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-4">
                  <th className="px-4 py-1.5 font-semibold">Stone</th>
                  <th className="px-3 py-1.5 font-semibold">Description</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Weight</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Quoted</th>
                  <th className="px-4 py-1.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {memo.lines.map((l) => (
                  <tr key={l.id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-1.5">
                      <Link
                        href={`/stones/${l.stoneId}`}
                        className="group flex items-center gap-2 whitespace-nowrap"
                      >
                        {l.thumbUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`/api/media/file/${l.thumbUrl}`}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover ring-1 ring-black/10"
                          />
                        ) : (
                          <GemSwatch colour={l.colour} variety={l.variety} size={22} />
                        )}
                        <span className="font-medium text-fg group-hover:text-accent group-hover:underline">
                          {l.stoneNo}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-fg-2">
                      {[l.variety, l.colour, l.shape, l.treatment, l.certLab]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {l.weightOutCt.toFixed(3)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {formatMoney(l.quotedPriceMinor)}
                    </td>
                    <td className="px-4 py-1.5">
                      <MemoOutcomeBadge outcome={l.outcome} />
                      {l.settledOn && (
                        <span className="ml-1.5 text-xs text-fg-4">
                          {formatDate(l.settledOn)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2 font-semibold">
                  <td className="px-4 py-2 text-fg-2" colSpan={2}>
                    {memo.lines.length} stone{memo.lines.length === 1 ? "" : "s"}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-fg">
                    {formatCt(memo.lines.reduce((a, l) => a + l.weightOutCt, 0))}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-fg">
                    {formatMoney(
                      memo.lines.reduce((a, l) => a + (l.quotedPriceMinor ?? 0n), 0n),
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ------------------------------------------- signature block */}
          <div className="print-only border-t border-line px-4 pt-6 pb-2">
            <div className="grid grid-cols-2 gap-12 text-xs">
              {["Received by", "Issued by"].map((label) => (
                <div key={label}>
                  <div className="h-10 border-b border-fg-3" />
                  <div className="mt-1 flex justify-between text-fg-3">
                    <span>{label}</span>
                    <span>Date</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-4 print:hidden">
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-line-soft px-4 py-1 text-sm">
              <Row label="With">{memo.party.name}</Row>
              {memo.party.phone && <Row label="Phone">{memo.party.phone}</Row>}
              <Row label="Issued">{formatDate(memo.issuedOn)}</Row>
              <Row label="Due back">{formatDate(memo.dueBack)}</Row>
              <Row label="Days out">
                <span className="tnum">{memo.daysOut}</span>
              </Row>
              {memo.closedOn && <Row label="Closed">{formatDate(memo.closedOn)}</Row>}
              <Row label="Issued by">{memo.createdBy.name}</Row>
              {memo.note && <Row label="Note">{memo.note}</Row>}
            </dl>
          </Card>

          {memo.extensionNote && (
            <Card>
              <CardHeader title="Extensions" />
              <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-xs text-fg-2">
                {memo.extensionNote}
              </pre>
              <p className="border-t border-line-soft px-4 py-2 text-xs text-fg-4">
                Repeated extensions on the same memo are worth a conversation.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
