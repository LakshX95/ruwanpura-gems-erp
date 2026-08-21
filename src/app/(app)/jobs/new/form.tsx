"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { issueJobAction, type JobState } from "../actions";
import {
  Button, Card, CardHeader, Field, Input, Select, Textarea,
} from "@/components/ui/primitives";
import { StonePicker, type PickableStone } from "@/components/stone-picker";

type Vendor = { id: string; name: string; note: string | null };

export function IssueJobForm({
  stones,
  vendors,
}: {
  stones: PickableStone[];
  vendors: Vendor[];
}) {
  const [state, formAction, pending] = useActionState<JobState, FormData>(
    issueJobAction,
    {},
  );
  const [kind, setKind] = useState<"CUTTING" | "HEATING" | "LAB">("CUTTING");

  // Vendors are tagged by the work they do, so the list narrows with the type.
  const suggested = vendors.filter((v) => {
    const n = (v.note ?? "").toLowerCase();
    if (kind === "CUTTING") return n.includes("cutting");
    if (kind === "HEATING") return n.includes("heat");
    return n.includes("labor") || n.includes("laborator") || n.includes("gemmolog");
  });
  const list = suggested.length ? suggested : vendors;

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <Card>
        <CardHeader title="The job" />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-4">
          <Field label="Type of work">
            <Select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="CUTTING">Cutting &amp; polishing</option>
              <option value="HEATING">Heat treatment</option>
              <option value="LAB">Laboratory / certification</option>
            </Select>
          </Field>
          <Field label="Vendor" className="sm:col-span-2">
            <Select name="vendorId" required defaultValue="">
              <option value="" disabled>
                — choose —
              </option>
              {list.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expected back" hint="Drives the overdue alert">
            <Input name="expectedBack" type="date" />
          </Field>

          <Field label="Charging basis">
            <Select name="chargeBasis" defaultValue="per_stone">
              <option value="per_stone">Per stone</option>
              <option value="per_carat">Per carat</option>
              <option value="fixed">Fixed for the job</option>
            </Select>
          </Field>
          <Field label="Instructions to the vendor" className="sm:col-span-3">
            <Textarea
              name="instructions"
              rows={2}
              placeholder={
                kind === "CUTTING"
                  ? "e.g. keep weight above 2 ct, oval preferred"
                  : kind === "HEATING"
                    ? "e.g. light heat only, no residue"
                    : "e.g. full report with origin opinion"
              }
            />
          </Field>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Which stones are going out"
          action={
            <span className="text-xs text-fg-4">
              Only stones currently in the safe can be sent
            </span>
          }
        />
        <StonePicker stones={stones} />
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <Link
          href="/jobs"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-fg-3 hover:bg-surface-3"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create job & issue stones"}
        </Button>
      </div>
    </form>
  );
}
