"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarRange } from "lucide-react";
import { Input, Select } from "@/components/ui/primitives";
import { PRESETS } from "@/lib/date-range";

/**
 * Period selector. Lives in the URL like the other filters so a chosen period
 * can be bookmarked, shared with the accountant, or kept on the back button.
 */
export function DateRangeFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const preset = params.get("period") ?? "all";

  function set(next: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    startTransition(() => router.push(`?${p.toString()}`));
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 print:hidden ${
        pending ? "opacity-60" : ""
      }`}
    >
      <CalendarRange size={14} className="text-fg-4" />
      <Select
        value={preset}
        onChange={(e) =>
          set({ period: e.target.value, from: "", to: "" })
        }
        className="w-40"
        aria-label="Period"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
        <option value="custom">Custom…</option>
      </Select>

      {preset === "custom" && (
        <>
          <Input
            type="date"
            defaultValue={params.get("from") ?? ""}
            onChange={(e) => set({ period: "custom", from: e.target.value })}
            className="w-36"
            aria-label="From"
          />
          <span className="text-fg-4">–</span>
          <Input
            type="date"
            defaultValue={params.get("to") ?? ""}
            onChange={(e) => set({ period: "custom", to: e.target.value })}
            className="w-36"
            aria-label="To"
          />
        </>
      )}
    </div>
  );
}
