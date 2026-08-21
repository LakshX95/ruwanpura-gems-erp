import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getReferenceData, nextStoneNo } from "@/lib/queries/stones";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/primitives";
import { NewStoneForm } from "./form";

export default async function NewStonePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!can(user, "stone:create")) {
    return <EmptyState title="You do not have permission to add stones." />;
  }

  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const ref = await getReferenceData();
  const varietyId = one("varietyId");
  const variety = varietyId
    ? await db.refVariety.findUnique({ where: { id: varietyId } })
    : null;
  const suggestedNo = await nextStoneNo(variety?.name);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Add a stone</h1>
        <p className="text-sm text-fg-3">
          Only the stone number and weight are required — everything else can be
          filled in later.
        </p>
      </div>

      <NewStoneForm
        varieties={ref.varieties}
        shapes={ref.shapes}
        colours={ref.colours}
        treatments={ref.treatments}
        locations={ref.locations}
        suggestedNo={suggestedNo}
        defaults={{
          varietyId,
          shapeId: one("shapeId"),
          treatmentId: one("treatmentId"),
          locationId: one("locationId"),
          origin: one("origin"),
        }}
        savedNo={one("saved")}
      />
    </div>
  );
}
