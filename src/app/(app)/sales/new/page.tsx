import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { sellableStones } from "@/lib/queries/sales";
import { Card, EmptyState } from "@/components/ui/primitives";
import { NewSaleForm } from "./form";

export default async function NewSalePage() {
  const user = await requireUser();
  if (!can(user, "sale:create")) {
    return (
      <Card>
        <EmptyState title="You do not have permission to record sales." />
      </Card>
    );
  }

  const [stones, customers] = await Promise.all([
    sellableStones(),
    db.party.findMany({
      where: { isCustomer: true, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Record a sale</h1>
        <p className="text-sm text-fg-3">
          Price per carat or as a total — whichever you agreed. The other is
          worked out from the weight.
        </p>
      </div>
      <NewSaleForm
        // BigInt does not cross the server/client boundary, so amounts travel
        // as strings and are parsed back where they are used.
        stones={stones.map((s) => ({
          ...s,
          askingPriceMinor: s.askingPriceMinor?.toString() ?? null,
          costMinor: s.costMinor.toString(),
        }))}
        customers={customers}
        showMargin={can(user, "margin:view")}
      />
    </div>
  );
}
