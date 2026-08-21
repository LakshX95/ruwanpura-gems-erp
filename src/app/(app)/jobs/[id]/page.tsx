import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getJob } from "@/lib/queries/jobs";
import { JOB_LABEL } from "@/lib/services/jobs";
import { Card, CardHeader, Restricted } from "@/components/ui/primitives";
import { GemSwatch } from "@/components/gem";
import { formatCt, formatDate, formatMoney } from "@/lib/format";
import { JobKindBadge, JobStatusBadge, OutcomeBadge, YieldFigure } from "../job-bits";
import { ReceiveForm } from "./receive-form";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-fg-3">{label}</dt>
      <dd className="text-right font-medium text-fg">{children}</dd>
    </div>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  const showCost = can(user, "cost:view");
  const canMove = can(user, "custody:move");
  const locations = await db.location.findMany({ orderBy: { name: "asc" } });

  const totalOut = job.lines.reduce((a, l) => a + l.weightOutCt, 0);
  const totalIn = job.lines.reduce((a, l) => a + (l.weightInCt ?? 0), 0);
  const totalCharge = job.lines.reduce((a, l) => a + (l.chargeMinor ?? 0n), 0n);
  const overallYield =
    job.status === "CLOSED" && totalOut > 0 ? (totalIn / totalOut) * 100 : null;

  // With the receive form on screen the read-only line table repeats it and
  // shows nothing but dashes, so it only appears when there is no form.
  const showLineTable = !(job.status === "OPEN" && canMove);

  return (
    <div className="space-y-4">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm text-fg-3 hover:text-fg"
      >
        <ArrowLeft size={14} /> All jobs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-fg">{job.jobNo}</h1>
            <JobKindBadge kind={job.kind} />
            <JobStatusBadge status={job.status} overdueDays={job.overdueDays} />
          </div>
          <p className="mt-0.5 text-sm text-fg-3">
            {JOB_LABEL[job.kind]} · {job.vendor.name} · {job.lines.length}{" "}
            {job.lines.length === 1 ? "stone" : "stones"} ·{" "}
            <span className="tnum">{formatCt(totalOut)}</span> out
          </p>
        </div>
        {overallYield != null && (
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-4">
              Yield
            </div>
            <div className="tnum text-xl font-semibold">
              <YieldFigure pct={overallYield} />
            </div>
            <div className="tnum text-xs text-fg-4">
              {formatCt(totalOut - totalIn)} lost
            </div>
          </div>
        )}
      </div>

      {job.status === "OPEN" && canMove && (
        <ReceiveForm job={job} locations={locations} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {showLineTable && (
        <Card className="lg:col-span-2">
          <CardHeader
            title={job.status === "OPEN" ? "Stones out on this job" : "What came back"}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-4">
                  <th className="px-4 py-1.5 font-semibold">Stone</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Out</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Back</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Yield</th>
                  <th className="px-3 py-1.5 font-semibold">Outcome</th>
                  <th className="px-4 py-1.5 text-right font-semibold">Charge</th>
                </tr>
              </thead>
              <tbody>
                {job.lines.map((l) => (
                  <tr key={l.id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-1.5">
                      <Link
                        href={`/stones/${l.stoneId}`}
                        className="group flex items-center gap-2"
                      >
                        <GemSwatch colour={l.colour} variety={l.variety} size={20} />
                        <span className="font-medium text-fg group-hover:text-accent group-hover:underline">
                          {l.stoneNo}
                        </span>
                        <span className="text-xs text-fg-4">{l.variety}</span>
                      </Link>
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {l.weightOutCt.toFixed(3)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {l.weightInCt == null ? "—" : l.weightInCt.toFixed(3)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <YieldFigure pct={l.yieldPct} />
                    </td>
                    <td className="px-3 py-1.5">
                      <OutcomeBadge outcome={l.outcome} />
                    </td>
                    <td className="tnum px-4 py-1.5 text-right text-fg">
                      {showCost ? formatMoney(l.chargeMinor) : <Restricted />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        )}

        <div className={`space-y-4 ${showLineTable ? "" : "lg:col-start-3"}`}>
          <Card>
            <CardHeader title="Job details" />
            <dl className="divide-y divide-line-soft px-4 py-1 text-sm">
              <Row label="Vendor">{job.vendor.name}</Row>
              {job.vendor.phone && <Row label="Phone">{job.vendor.phone}</Row>}
              <Row label="Issued">{formatDate(job.issuedOn)}</Row>
              <Row label="Expected back">{formatDate(job.expectedBack)}</Row>
              <Row label="Returned">{formatDate(job.returnedOn)}</Row>
              {job.turnaroundDays != null && (
                <Row label="Turnaround">
                  <span className="tnum">{job.turnaroundDays} days</span>
                </Row>
              )}
              <Row label="Charging">{job.chargeBasis.replace("_", " ")}</Row>
              <Row label="Total charge">
                <span className="tnum">
                  {showCost ? formatMoney(totalCharge) : <Restricted />}
                </span>
              </Row>
              <Row label="Issued by">{job.createdBy.name}</Row>
            </dl>
          </Card>

          {job.instructions && (
            <Card>
              <CardHeader title="Instructions" />
              <p className="px-4 py-3 text-sm text-fg-2">{job.instructions}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
