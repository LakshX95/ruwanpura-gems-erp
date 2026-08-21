"use client";

import { useActionState, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { extendMemoAction, type MemoState } from "../actions";
import { Button, Input } from "@/components/ui/primitives";

export function ExtendMemoForm({ memoId }: { memoId: string }) {
  const [state, formAction, pending] = useActionState<MemoState, FormData>(
    extendMemoAction,
    {},
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-sm font-medium text-fg-2 hover:border-fg-5 print:hidden"
      >
        <CalendarPlus size={14} /> Extend
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 print:hidden">
      <input type="hidden" name="memoId" value={memoId} />
      <Input name="newDueBack" type="date" required className="w-36" aria-label="New due date" />
      <Input name="reason" placeholder="Reason" className="w-44" aria-label="Reason" />
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? "Saving…" : "Save"}
      </Button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md px-2 py-1.5 text-sm text-fg-3 hover:bg-surface-3"
      >
        Cancel
      </button>
      {state.error && (
        <span role="alert" className="text-xs text-danger">{state.error}</span>
      )}
    </form>
  );
}
