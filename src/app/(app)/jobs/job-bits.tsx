import { Badge } from "@/components/ui/primitives";
import type { JobKind, JobLineOutcome, JobStatus } from "@/generated/prisma/enums";

export const JOB_KIND_LABEL: Record<JobKind, string> = {
  CUTTING: "Cutting",
  HEATING: "Heating",
  LAB: "Laboratory",
};

export function JobKindBadge({ kind }: { kind: JobKind }) {
  const tone = kind === "CUTTING" ? "blue" : kind === "HEATING" ? "amber" : "neutral";
  return <Badge tone={tone}>{JOB_KIND_LABEL[kind]}</Badge>;
}

export function JobStatusBadge({
  status,
  overdueDays = 0,
}: {
  status: JobStatus;
  overdueDays?: number;
}) {
  if (status === "OPEN" && overdueDays > 0) {
    return <Badge tone="red">{overdueDays}d overdue</Badge>;
  }
  if (status === "OPEN") return <Badge tone="green">Open</Badge>;
  if (status === "CANCELLED") return <Badge tone="neutral">Cancelled</Badge>;
  return <Badge tone="neutral">Closed</Badge>;
}

export const OUTCOME_LABEL: Record<JobLineOutcome, string> = {
  RETURNED: "Returned",
  LOST: "Lost in treatment",
  BROKEN: "Broken",
  REJECTED: "Rejected by vendor",
};

export function OutcomeBadge({ outcome }: { outcome: JobLineOutcome | null }) {
  if (!outcome) return <span className="text-fg-5">—</span>;
  const tone =
    outcome === "RETURNED" ? "green" : outcome === "REJECTED" ? "neutral" : "red";
  return <Badge tone={tone}>{OUTCOME_LABEL[outcome]}</Badge>;
}

/**
 * Yield colouring uses the trade's own rough thresholds. Anything under about
 * a fifth back from a recut is a conversation with the cutter.
 */
export function YieldFigure({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-fg-5">—</span>;
  const tone =
    pct >= 80 ? "text-accent" : pct >= 65 ? "text-fg" : "text-warn";
  return <span className={`tnum font-medium ${tone}`}>{pct.toFixed(1)}%</span>;
}
