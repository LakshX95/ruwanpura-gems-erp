import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { availableStones } from "@/lib/queries/jobs";
import { Card, EmptyState } from "@/components/ui/primitives";
import { IssueJobForm } from "./form";

export default async function NewJobPage() {
  const user = await requireUser();
  if (!can(user, "custody:move")) {
    return (
      <Card>
        <EmptyState title="You do not have permission to send stones out." />
      </Card>
    );
  }

  const [stones, vendors] = await Promise.all([
    availableStones(undefined, 400),
    db.party.findMany({
      where: { isVendor: true, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, note: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Send stones out</h1>
        <p className="text-sm text-fg-3">
          Creates a job, moves the stones out of the safe, and records who signed
          for them.
        </p>
      </div>
      <IssueJobForm stones={stones} vendors={vendors} />
    </div>
  );
}
