import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getReferenceData, listStones, PER_PAGE } from "@/lib/queries/stones";
import type { StoneStatus } from "@/generated/prisma/enums";
import {
  ButtonLink, Card, EmptyState, Restricted,
} from "@/components/ui/primitives";
import { GemSwatch, KindBadge, StatusBadge, TreatmentBadge } from "@/components/gem";
import { formatMoneyShort } from "@/lib/format";
import { FilterBar } from "./filter-bar";
import { Suspense } from "react";
import { PageActions } from "@/components/page-actions";
import { PrintHeader } from "@/components/print-header";

const num = (v: string | undefined) =>
  v && !Number.isNaN(Number(v)) ? Number(v) : undefined;

export default async function StonesPage({
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

  const filters = {
    q: one("q"),
    varietyId: one("varietyId"),
    status: one("status") as StoneStatus | undefined,
    treatmentId: one("treatmentId"),
    locationId: one("locationId"),
    minCt: num(one("minCt")),
    maxCt: num(one("maxCt")),
    page: num(one("page")) ?? 1,
    sort: (one("sort") ?? "recent") as "recent" | "weight" | "stoneNo" | "cost",
  };

  const [{ items, total, page, pages }, ref] = await Promise.all([
    listStones(filters),
    getReferenceData(),
  ]);

  const showCost = can(user, "cost:view");
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    Object.entries(sp).forEach(([k, v]) => {
      if (typeof v === "string" && k !== "page") next.set(k, v);
    });
    next.set("page", String(p));
    return `/stones?${next.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Stones</h1>
          <p className="text-sm text-fg-3">
            {total.toLocaleString()} record{total === 1 ? "" : "s"}
            {from > 0 && ` · showing ${from}–${to}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <PageActions dataset="stones" labels />
          </Suspense>
          {can(user, "stone:create") && (
            <ButtonLink href="/stones/new">
              <Plus size={15} /> Add stone
            </ButtonLink>
          )}
        </div>
      </div>

      <PrintHeader
        title="Stock register"
        subtitle={`${total} records`}
      />

      <Card className="p-3">
        <FilterBar
          varieties={ref.varieties}
          treatments={ref.treatments}
          locations={ref.locations}
        />
      </Card>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title="No stones match these filters"
            hint="Try clearing a filter, or widening the weight range."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-3">
                  <th className="px-3 py-2 font-semibold">Stone</th>
                  <th className="px-3 py-2 font-semibold">Variety</th>
                  <th className="px-3 py-2 text-right font-semibold">Weight</th>
                  <th className="px-3 py-2 font-semibold">Shape</th>
                  <th className="px-3 py-2 font-semibold">Colour</th>
                  <th className="px-3 py-2 font-semibold">Treatment</th>
                  <th className="px-3 py-2 font-semibold">Cert</th>
                  <th className="px-3 py-2 font-semibold">Where</th>
                  <th className="px-3 py-2 text-right font-semibold">Cost</th>
                  <th className="px-3 py-2 text-right font-semibold">Asking</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-line-soft last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/stones/${s.id}`}
                        className="group flex items-center gap-2 whitespace-nowrap"
                      >
                        {s.thumbUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`/api/media/file/${s.thumbUrl}`}
                            alt=""
                            className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-black/10"
                          />
                        ) : (
                          <GemSwatch colour={s.colour} variety={s.variety} size={24} />
                        )}
                        <span className="font-medium text-fg group-hover:text-accent group-hover:underline">
                          {s.stoneNo}
                        </span>
                        {s.kind !== "STONE" && <KindBadge kind={s.kind} />}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-fg-2">{s.variety ?? "—"}</td>
                    <td className="tnum px-3 py-1.5 text-right font-medium text-fg">
                      {s.weightCt.toFixed(3)}
                      {s.pieceCount > 1 && (
                        <span className="ml-1 text-xs text-fg-4">
                          /{s.pieceCount}pc
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-fg-2">{s.shape ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-fg-2">{s.colour ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <TreatmentBadge treatment={s.treatment} />
                    </td>
                    <td className="px-3 py-1.5 text-xs text-fg-3">
                      {s.certLab ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-fg-2">
                      {s.heldBy ? (
                        <span className="text-warn">{s.heldBy}</span>
                      ) : (
                        s.location ?? "—"
                      )}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg">
                      {showCost ? formatMoneyShort(s.totalCostMinor) : <Restricted />}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg">
                      {formatMoneyShort(s.askingPriceMinor)}
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-sm">
            <span className="text-fg-3">
              Page {page} of {pages}
            </span>
            <div className="flex gap-1">
              {page > 1 && (
                <Link
                  href={pageHref(page - 1)}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={pageHref(page + 1)}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
