"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/primitives";

type Option = { id: string; name: string };

/**
 * Filters live in the URL, so a filtered view can be bookmarked, shared, or
 * kept on the back button — which is how people actually use a stock list.
 */
export function FilterBar({
  varieties,
  treatments,
  locations,
}: {
  varieties: Option[];
  treatments: Option[];
  locations: Option[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // a changed filter always returns to page one
    startTransition(() => router.push(`/stones?${next.toString()}`));
  }

  const active =
    params.get("q") ||
    params.get("varietyId") ||
    params.get("status") ||
    params.get("treatmentId") ||
    params.get("locationId") ||
    params.get("minCt") ||
    params.get("maxCt");

  return (
    <div
      className={`flex flex-wrap items-end gap-2 ${pending ? "opacity-60" : ""}`}
    >
      <div className="relative min-w-56 flex-1">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-4"
        />
        <Input
          defaultValue={params.get("q") ?? ""}
          placeholder="Stone no, certificate no, colour…"
          className="pl-8"
          onKeyDown={(e) => {
            if (e.key === "Enter") set("q", e.currentTarget.value);
          }}
          onBlur={(e) => {
            if (e.currentTarget.value !== (params.get("q") ?? ""))
              set("q", e.currentTarget.value);
          }}
        />
      </div>

      <Select
        value={params.get("varietyId") ?? ""}
        onChange={(e) => set("varietyId", e.target.value)}
        className="w-44"
      >
        <option value="">All varieties</option>
        {varieties.map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </Select>

      <Select
        value={params.get("status") ?? ""}
        onChange={(e) => set("status", e.target.value)}
        className="w-36"
      >
        <option value="">Any status</option>
        <option value="IN_STOCK">In stock</option>
        <option value="OUT">Out</option>
        <option value="SOLD">Sold</option>
        <option value="CONSUMED">Split</option>
        <option value="WRITTEN_OFF">Written off</option>
      </Select>

      <Select
        value={params.get("treatmentId") ?? ""}
        onChange={(e) => set("treatmentId", e.target.value)}
        className="w-44"
      >
        <option value="">Any treatment</option>
        {treatments.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </Select>

      <Select
        value={params.get("locationId") ?? ""}
        onChange={(e) => set("locationId", e.target.value)}
        className="w-44"
      >
        <option value="">Any location</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </Select>

      <div className="flex items-end gap-1">
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="min ct"
          defaultValue={params.get("minCt") ?? ""}
          className="w-20"
          onBlur={(e) => set("minCt", e.currentTarget.value)}
        />
        <span className="pb-1.5 text-fg-4">–</span>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="max ct"
          defaultValue={params.get("maxCt") ?? ""}
          className="w-20"
          onBlur={(e) => set("maxCt", e.currentTarget.value)}
        />
      </div>

      {active && (
        <button
          onClick={() => startTransition(() => router.push("/stones"))}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-fg-3 hover:bg-surface-3 hover:text-fg"
        >
          <X size={13} /> Clear
        </button>
      )}
    </div>
  );
}
