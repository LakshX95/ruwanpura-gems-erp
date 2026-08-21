import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listJobs } from "@/lib/queries/jobs";
import type { JobKind, JobStatus } from "@/generated/prisma/enums";
import { ButtonLink, Card, EmptyState, Restricted } from "@/components/ui/primitives";
import { formatDate, formatMoneyShort } from "@/lib/format";
import { JobKindBadge, JobStatusBadge, YieldFigure } from "./job-bits";
import { Suspense } from "react";
import { PageActions } from "@/components/page-actions";
import { PrintHeader } from "@/components/print-header";

const TABS: { label: string; status?: JobStatus }[] = [
  { label: "Open", status: "OPEN" },
  { label: "Closed", status: "CLOSED" },
  { label: "All" },
];

export default async function JobsPage({
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
  const status = (one("status") as JobStatus | undefined) ?? "OPEN";
  const kind = one("kind") as JobKind | undefined;

  const jobs = await listJobs({
    status: status === ("ALL" as JobStatus) ? undefined : status,
    kind,
  });
  const showCost = can(user, "cost:view");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Jobs</h1>
          <p className="text-sm text-fg-3">
            Stones sent out for cutting, heat treatment and certification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <PageActions dataset="jobs" />
          </Suspense>
          {can(user, "custody:move") && (
            <ButtonLink href="/jobs/new">
              <Plus size={15} /> Send stones out
            </ButtonLink>
          )}
        </div>
      </div>

      <PrintHeader title="Jobs" subtitle={`${jobs.length} shown`} />

      <div className="flex gap-1">
        {TABS.map((t) => {
          const value = t.status ?? "ALL";
          const active = (status as string) === value;
          return (
            <Link
              key={value}
              href={`/jobs?status=${value}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-fg-3 hover:bg-surface-3 hover:text-fg"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs here"
            hint="Sending stones to a cutter, heater or laboratory creates a job with a signed record of what went out."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-3">
                  <th className="px-3 py-2 font-semibold">Job</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Vendor</th>
                  <th className="px-3 py-2 text-right font-semibold">Stones</th>
                  <th className="px-3 py-2 text-right font-semibold">Out</th>
                  <th className="px-3 py-2 text-right font-semibold">Back</th>
                  <th className="px-3 py-2 text-right font-semibold">Yield</th>
                  <th className="px-3 py-2 font-semibold">Issued</th>
                  <th className="px-3 py-2 font-semibold">Due / returned</th>
                  <th className="px-3 py-2 text-right font-semibold">Charge</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr
                    key={j.id}
                    className={`border-b border-line-soft last:border-0 hover:bg-surface-2 ${
                      j.overdueDays > 0 ? "bg-warn-soft/70" : ""
                    }`}
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/jobs/${j.id}`}
                        className="font-medium text-fg hover:text-accent hover:underline"
                      >
                        {j.jobNo}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5"><JobKindBadge kind={j.kind} /></td>
                    <td className="px-3 py-1.5 text-fg-2">{j.vendor}</td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {j.stoneCount}
                      {j.lostCount > 0 && (
                        <span className="ml-1 text-xs text-danger">
                          −{j.lostCount}
                        </span>
                      )}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {j.weightOutCt.toFixed(3)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {j.weightInCt == null ? "—" : j.weightInCt.toFixed(3)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <YieldFigure pct={j.yieldPct} />
                    </td>
                    <td className="tnum px-3 py-1.5 text-fg-3">
                      {formatDate(j.issuedOn)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-fg-3">
                      {formatDate(j.returnedOn ?? j.expectedBack)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg">
                      {!showCost ? (
                        <Restricted />
                      ) : j.status === "OPEN" ? (
                        <span className="text-fg-5">—</span>
                      ) : (
                        formatMoneyShort(j.chargeMinor)
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <JobStatusBadge status={j.status} overdueDays={j.overdueDays} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-fg-4">
        Total weight out is what left the safe; weight back is what returned.
        The difference is the yield, and it is measured per vendor on the{" "}
        <Link href="/reports" className="text-accent hover:underline">
          reports page
        </Link>
        .
      </p>
    </div>
  );
}
