import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { listStones } from "@/lib/queries/stones";
import { db } from "@/lib/db";
import type { StoneStatus } from "@/generated/prisma/enums";
import { stoneQrSvg } from "@/lib/qr";
import { Card } from "@/components/ui/primitives";
import { PrintButton } from "@/components/page-actions";
import { formatCt } from "@/lib/format";

const num = (v: string | undefined) =>
  v && !Number.isNaN(Number(v)) ? Number(v) : undefined;

/** A sheet will not usefully hold more than this, and the QR work is real. */
const MAX_LABELS = 120;

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  // Absolute URLs, because the label is scanned by a phone that has no idea
  // what the app's origin is.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${h.get("host") ?? "localhost:3000"}`;

  const ids = one("ids")?.split(",").filter(Boolean);
  let stones;
  if (ids?.length) {
    const rows = await db.stone.findMany({
      where: { id: { in: ids.slice(0, MAX_LABELS) } },
      orderBy: { stoneNo: "asc" },
      select: {
        id: true, stoneNo: true, weightCt: true, certLab: true, certNo: true,
        variety: { select: { name: true } },
        colour: { select: { name: true } },
        treatment: { select: { name: true } },
        location: { select: { name: true } },
      },
    });
    stones = rows.map((r) => ({
      id: r.id,
      stoneNo: r.stoneNo,
      weightCt: Number(r.weightCt.toString()),
      variety: r.variety?.name ?? null,
      colour: r.colour?.name ?? null,
      treatment: r.treatment?.name ?? null,
      certLab: r.certLab,
      location: r.location?.name ?? null,
    }));
  } else {
    const { items } = await listStones({
      q: one("q"),
      varietyId: one("varietyId"),
      status: (one("status") as StoneStatus) ?? undefined,
      treatmentId: one("treatmentId"),
      locationId: one("locationId"),
      minCt: num(one("minCt")),
      maxCt: num(one("maxCt")),
      page: 1,
      perPage: MAX_LABELS,
      sort: "stoneNo",
    });
    stones = items.map((s) => ({
      id: s.id,
      stoneNo: s.stoneNo,
      weightCt: s.weightCt,
      variety: s.variety,
      colour: s.colour,
      treatment: s.treatment,
      certLab: s.certLab,
      location: s.location,
    }));
  }

  const withQr = await Promise.all(
    stones.map(async (s) => ({
      ...s,
      qr: await stoneQrSvg(`${origin}/stones/${s.id}`, 96),
    })),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <Link
            href="/stones"
            className="inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg"
          >
            <ArrowLeft size={14} /> Back to stones
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-fg">Packet labels</h1>
          <p className="text-sm text-fg-3">
            {withQr.length} label{withQr.length === 1 ? "" : "s"} · scanning one
            opens that stone&rsquo;s record on any phone
            {withQr.length === MAX_LABELS && " · showing the first 120"}
          </p>
        </div>
        <PrintButton label="Print labels" />
      </div>

      <Card className="p-4 print:border-0 print:p-0 print:shadow-none">
        <div className="labels-grid">
          {withQr.map((s) => (
            <div key={s.id} className="label">
              <div
                className="label-qr"
                // qrcode returns a self-contained SVG string.
                dangerouslySetInnerHTML={{ __html: s.qr }}
              />
              <div className="label-text">
                <div className="label-no">{s.stoneNo}</div>
                <div className="label-line">
                  {[s.variety, s.colour].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="label-line label-strong">
                  {formatCt(s.weightCt)}
                  {s.treatment && ` · ${/^none/i.test(s.treatment) ? "Unheated" : s.treatment}`}
                </div>
                <div className="label-line label-faint">
                  {[s.certLab, s.location].filter(Boolean).join(" · ") || " "}
                </div>
              </div>
            </div>
          ))}
        </div>
        {withQr.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-4">
            No stones match those filters.
          </p>
        )}
      </Card>
    </div>
  );
}
