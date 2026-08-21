import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { memoableStones } from "@/lib/queries/memos";
import { Card, EmptyState } from "@/components/ui/primitives";
import { IssueMemoForm } from "./form";

export default async function NewMemoPage() {
  const user = await requireUser();
  if (!can(user, "memo:create")) {
    return (
      <Card>
        <EmptyState title="You do not have permission to issue memos." />
      </Card>
    );
  }

  const [stones, parties] = await Promise.all([
    memoableStones(),
    db.party.findMany({
      where: { isActive: true, OR: [{ isCustomer: true }, { isSupplier: true }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Send stones on memo</h1>
        <p className="text-sm text-fg-3">
          Records what went out, to whom, and when it is due back — and prints a
          voucher to sign.
        </p>
      </div>
      <IssueMemoForm
        // askingPriceMinor is a BigInt and does not cross the server/client
        // boundary; the picker does not need it.
        stones={stones.map((s) => ({
          id: s.id,
          stoneNo: s.stoneNo,
          weightCt: s.weightCt,
          variety: s.variety,
          colour: s.colour,
          location: s.location,
        }))}
        parties={parties}
      />
    </div>
  );
}
