"use client";

import Link from "next/link";
import { useActionState } from "react";
import { issueMemoAction, type MemoState } from "../actions";
import {
  Button, Card, CardHeader, Field, Input, Select, Textarea,
} from "@/components/ui/primitives";
import { StonePicker, type PickableStone } from "@/components/stone-picker";

/** Default return window. Two weeks is the common trade term — confirm per client. */
function defaultDueBack(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function IssueMemoForm({
  stones,
  parties,
}: {
  stones: PickableStone[];
  parties: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<MemoState, FormData>(
    issueMemoAction,
    {},
  );

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
        <CardHeader title="Who is taking the goods" />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-4">
          <Field label="Customer or dealer" className="sm:col-span-2">
            <Select name="partyId" required defaultValue="">
              <option value="" disabled>— choose —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Due back" hint="Drives the overdue alert">
            <Input name="dueBack" type="date" required defaultValue={defaultDueBack()} />
          </Field>
          <Field label="Note">
            <Textarea name="note" rows={1} placeholder="Terms agreed" />
          </Field>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Which stones are going out"
          action={
            <span className="text-xs text-fg-4">
              They remain your property while out
            </span>
          }
        />
        <StonePicker stones={stones} />
      </Card>

      <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-2 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <Link
          href="/memos"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-fg-3 hover:bg-surface-3"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Issue memo"}
        </Button>
      </div>
    </form>
  );
}
