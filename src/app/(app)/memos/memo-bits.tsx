import { Badge } from "@/components/ui/primitives";
import type { MemoLineOutcome, MemoStatus } from "@/generated/prisma/enums";

export function MemoStatusBadge({
  status,
  daysOverdue = 0,
}: {
  status: MemoStatus;
  daysOverdue?: number;
}) {
  if (status === "OPEN" && daysOverdue > 0) {
    return <Badge tone="red">{daysOverdue}d overdue</Badge>;
  }
  if (status === "OPEN") return <Badge tone="green">Out</Badge>;
  if (status === "CANCELLED") return <Badge tone="neutral">Cancelled</Badge>;
  return <Badge tone="neutral">Closed</Badge>;
}

export const OUTCOME_LABEL: Record<MemoLineOutcome, string> = {
  RETURNED: "Returned",
  SOLD: "Sold",
  LOST: "Not returned",
};

export function MemoOutcomeBadge({
  outcome,
}: {
  outcome: MemoLineOutcome | null;
}) {
  if (!outcome) return <Badge tone="amber">Still out</Badge>;
  const tone =
    outcome === "RETURNED" ? "neutral" : outcome === "SOLD" ? "green" : "red";
  return <Badge tone={tone}>{OUTCOME_LABEL[outcome]}</Badge>;
}
