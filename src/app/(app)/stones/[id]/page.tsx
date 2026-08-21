import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitBranch, QrCode, Split } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getStone } from "@/lib/queries/stones";
import { Badge, Card, CardHeader, Restricted } from "@/components/ui/primitives";
import { GemSwatch, KindBadge, StatusBadge, TreatmentBadge } from "@/components/gem";
import { StonePhotos } from "@/components/stone-photos";
import {
  daysSince, formatCt, formatDate, formatMm, formatMoney, perCaratMinor,
} from "@/lib/format";
import type { CostKind } from "@/generated/prisma/enums";

const COST_LABEL: Record<CostKind, string> = {
  PURCHASE: "Purchase",
  ALLOCATION: "Share of parcel cost",
  CUTTING: "Cutting & polishing",
  HEATING: "Heat treatment",
  LAB: "Certification",
  FREIGHT: "Freight",
  BROKERAGE: "Brokerage",
  OTHER: "Other",
};

const CUSTODY_LABEL: Record<string, string> = {
  RECEIPT: "Received into stock",
  INTERNAL_MOVE: "Moved",
  CUTTING: "Sent for cutting",
  HEATING: "Sent for heat treatment",
  LAB: "Sent to laboratory",
  MEMO: "Out on memo",
  SHOW: "Taken to trade show",
  RETURN: "Returned",
  SALE: "Sold and delivered",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-fg-3">{label}</dt>
      <dd className="text-right font-medium text-fg">{children}</dd>
    </div>
  );
}

export default async function StoneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const s = await getStone(id);
  if (!s) notFound();

  const showCost = can(user, "cost:view");
  const showMargin = can(user, "margin:view");
  const perCt = perCaratMinor(s.totalCostMinor, s.weightCt);
  const askPerCt = s.askingPriceMinor
    ? perCaratMinor(s.askingPriceMinor, s.weightCt)
    : null;
  const marginMinor =
    s.askingPriceMinor != null ? s.askingPriceMinor - s.totalCostMinor : null;
  const mainPhoto = s.media.find((m) => m.isMain) ?? s.media[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href="/stones"
          className="inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg"
        >
          <ArrowLeft size={14} /> All stones
        </Link>
        <Link
          href={`/labels?ids=${s.id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm font-medium text-fg-2 hover:border-fg-5 hover:text-fg"
        >
          <QrCode size={14} /> Packet label
        </Link>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {mainPhoto ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/media/file/${mainPhoto.thumbUrl ?? mainPhoto.url}`}
            alt=""
            className="h-16 w-16 shrink-0 rounded-md border border-line object-cover"
          />
        ) : (
          <GemSwatch colour={s.colour?.name} variety={s.variety?.name} size={64} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-fg">{s.stoneNo}</h1>
            <StatusBadge status={s.status} />
            <KindBadge kind={s.kind} />
            <TreatmentBadge treatment={s.treatment?.name} />
          </div>
          <p className="mt-0.5 text-sm text-fg-3">
            {[s.variety?.name, s.colour?.name, s.shape?.name]
              .filter(Boolean)
              .join(" · ")}{" "}
            · <span className="tnum font-medium text-fg-2">{formatCt(s.weightCt)}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-4">
            Landed cost
          </div>
          <div className="tnum text-xl font-semibold text-fg">
            {showCost ? formatMoney(s.totalCostMinor) : <Restricted />}
          </div>
          {showCost && perCt != null && (
            <div className="tnum text-xs text-fg-4">
              {formatMoney(perCt)} per carat
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Cost breakdown — the screen that wins the demo. */}
          <Card>
            <CardHeader title="Cost breakdown" />
            {!showCost ? (
              <p className="px-4 py-8 text-center text-sm text-fg-4">
                Cost figures are not visible to your role.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-4">
                    <th className="px-4 py-1.5 font-semibold">Date</th>
                    <th className="px-4 py-1.5 font-semibold">Type</th>
                    <th className="px-4 py-1.5 font-semibold">Detail</th>
                    <th className="px-4 py-1.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {s.costEntries.map((c) => (
                    <tr key={c.id} className="border-b border-line-soft">
                      <td className="tnum px-4 py-1.5 whitespace-nowrap text-fg-3">
                        {formatDate(c.incurredOn)}
                      </td>
                      <td className="px-4 py-1.5">
                        <Badge tone={c.kind === "PURCHASE" || c.kind === "ALLOCATION" ? "green" : "neutral"}>
                          {COST_LABEL[c.kind]}
                        </Badge>
                      </td>
                      <td className="px-4 py-1.5 text-fg-3">{c.note ?? c.sourceDoc ?? "—"}</td>
                      <td className="tnum px-4 py-1.5 text-right font-medium text-fg">
                        {formatMoney(c.baseMinor, c.currency)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-surface-2">
                    <td colSpan={3} className="px-4 py-2 text-right font-semibold text-fg-2">
                      Total landed cost
                    </td>
                    <td className="tnum px-4 py-2 text-right font-semibold text-fg">
                      {formatMoney(s.totalCostMinor)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </Card>

          {/* Genealogy: where it came from, and what it became. */}
          {(s.parent || s.children) && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <GitBranch size={14} /> Origin &amp; descendants
                  </span>
                }
              />
              <div className="space-y-4 px-4 py-3">
                {s.parent && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-4">
                      Cut from
                    </div>
                    {s.parent.inputs.map((p) => (
                      <Link
                        key={p.id}
                        href={`/stones/${p.id}`}
                        className="flex items-center justify-between rounded-md border border-line px-3 py-2 hover:border-accent hover:bg-accent-soft/40"
                      >
                        <span className="font-medium text-fg">{p.stoneNo}</span>
                        <span className="tnum text-sm text-fg-3">
                          {formatCt(p.weightCt)} rough
                        </span>
                      </Link>
                    ))}
                    <p className="mt-1.5 text-xs text-fg-4">
                      Split on {formatDate(s.parent.occurredAt)} · cost allocated{" "}
                      {s.parent.costAllocMethod.replace("_", " ")} ·{" "}
                      {formatCt(s.parent.lossCt)} lost in cutting
                    </p>
                  </div>
                )}

                {s.children && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-4">
                      <Split size={12} /> Became {s.children.outputs.length} stones
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {s.children.outputs.map((c) => (
                        <Link
                          key={c.id}
                          href={`/stones/${c.id}`}
                          className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 hover:border-accent hover:bg-accent-soft/40"
                        >
                          <GemSwatch colour={c.colour} variety={c.variety} size={20} />
                          <span className="flex-1 truncate text-sm font-medium text-fg">
                            {c.stoneNo}
                          </span>
                          <span className="tnum text-xs text-fg-3">
                            {c.weightCt.toFixed(3)} ct
                          </span>
                          <StatusBadge status={c.status} />
                        </Link>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-fg-4">
                      {formatCt(s.children.lossCt)} lost ·{" "}
                      {(
                        (s.children.outputs.reduce((a, c) => a + c.weightCt, 0) /
                          s.weightCt) *
                        100
                      ).toFixed(1)}
                      % yield
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Movement history" />
            <ul className="divide-y divide-line-soft">
              {s.custodyEvents.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-fg-4">
                  No movements recorded.
                </li>
              )}
              {s.custodyEvents.map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 px-4 py-2 text-sm">
                  <span className="tnum w-24 shrink-0 text-xs text-fg-4">
                    {formatDate(e.occurredAt)}
                  </span>
                  <span className="flex-1">
                    <span className="font-medium text-fg">
                      {CUSTODY_LABEL[e.reason] ?? e.reason}
                    </span>
                    {(e.toParty || e.toLocation) && (
                      <span className="text-fg-3">
                        {" "}
                        — {e.toParty?.name ?? e.toLocation?.name}
                      </span>
                    )}
                    {e.expectedBack && (
                      <span className="text-fg-4">
                        {" "}
                        · due back {formatDate(e.expectedBack)}
                      </span>
                    )}
                  </span>
                  <span className="tnum shrink-0 text-xs text-fg-4">
                    {formatCt(e.weightCt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <StonePhotos
            stoneId={s.id}
            photos={s.media.map((m) => ({
              id: m.id, url: m.url, thumbUrl: m.thumbUrl, isMain: m.isMain,
            }))}
            colour={s.colour?.name ?? null}
            variety={s.variety?.name ?? null}
            canEdit={can(user, "stone:edit")}
          />

          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-line-soft px-4 py-1 text-sm">
              <Row label="Weight">
                <span className="tnum">{formatCt(s.weightCt)}</span>
              </Row>
              <Row label="Dimensions">
                <span className="tnum">
                  {s.lengthMm && s.widthMm
                    ? `${formatMm(s.lengthMm)} × ${formatMm(s.widthMm)} × ${formatMm(s.depthMm)} mm`
                    : "—"}
                </span>
              </Row>
              <Row label="Clarity">{s.clarity ?? "—"}</Row>
              <Row label="Origin">{s.origin ?? "—"}</Row>
              <Row label="Certificate">
                {s.certLab ? `${s.certLab} ${s.certNo ?? ""}` : "Not certified"}
              </Row>
              <Row label="Location">
                {s.heldBy ? (
                  <span className="text-warn">With {s.heldBy.name}</span>
                ) : (
                  s.location?.name ?? "—"
                )}
              </Row>
              <Row label="In stock for">{daysSince(s.createdAt)} days</Row>
              <Row label="Added by">{s.createdBy.name}</Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Pricing" />
            <dl className="divide-y divide-line-soft px-4 py-1 text-sm">
              <Row label="Landed cost">
                <span className="tnum">
                  {showCost ? formatMoney(s.totalCostMinor) : <Restricted />}
                </span>
              </Row>
              <Row label="Cost per carat">
                <span className="tnum">
                  {showCost ? formatMoney(perCt) : <Restricted />}
                </span>
              </Row>
              <Row label="Asking price">
                <span className="tnum">{formatMoney(s.askingPriceMinor)}</span>
              </Row>
              <Row label="Asking per carat">
                <span className="tnum">{formatMoney(askPerCt)}</span>
              </Row>
              {showMargin && marginMinor != null && (
                <Row label="Margin if sold at asking">
                  <span
                    className={`tnum ${marginMinor >= 0n ? "text-accent" : "text-danger"}`}
                  >
                    {formatMoney(marginMinor)}
                  </span>
                </Row>
              )}
            </dl>
          </Card>

          {s.purchase && (
            <Card>
              <CardHeader title="Purchase" />
              <dl className="divide-y divide-line-soft px-4 py-1 text-sm">
                <Row label="Reference">{s.purchase.purchaseNo}</Row>
                <Row label="Supplier">{s.purchase.supplier.name}</Row>
                <Row label="Date">{formatDate(s.purchase.purchasedOn)}</Row>
                <Row label="Parcel weight">
                  <span className="tnum">{formatCt(s.purchase.weightCt)}</span>
                </Row>
                <Row label="Parcel cost">
                  <span className="tnum">
                    {showCost ? formatMoney(s.purchase.totalMinor, s.purchase.currency) : <Restricted />}
                  </span>
                </Row>
                {s.purchase.brokerName && (
                  <Row label="Broker">{s.purchase.brokerName}</Row>
                )}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
