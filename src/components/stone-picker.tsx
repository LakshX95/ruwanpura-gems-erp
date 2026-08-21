"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/primitives";
import { GemSwatch } from "@/components/gem";

export type PickableStone = {
  id: string;
  stoneNo: string;
  weightCt: number;
  variety: string | null;
  colour: string | null;
  location: string | null;
};

/**
 * Selecting stones to send out — shared by job issue and memo issue.
 *
 * Kept on one screen with a live filter rather than a modal: a session sends a
 * dozen stones at a time, and the running total of weight is what gets checked
 * against the other party's scale at handover.
 */
export function StonePicker({ stones }: { stones: PickableStone[] }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stones;
    return stones.filter(
      (s) =>
        s.stoneNo.toLowerCase().includes(needle) ||
        (s.variety ?? "").toLowerCase().includes(needle) ||
        (s.colour ?? "").toLowerCase().includes(needle),
    );
  }, [q, stones]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = stones.filter((s) => selected.has(s.id));
  const totalCt = chosen.reduce((a, s) => a + s.weightCt, 0);

  return (
    <div>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="stoneIds" value={id} />
      ))}

      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-4"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by stone number, variety or colour…"
            className="pl-8"
          />
        </div>
        <div className="shrink-0 text-sm">
          <span className="font-semibold text-fg">{selected.size}</span>
          <span className="text-fg-3"> selected · </span>
          <span className="tnum font-semibold text-fg">
            {totalCt.toFixed(3)}
          </span>
          <span className="text-fg-3"> ct</span>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-fg-3 hover:bg-surface-3"
          >
            Clear
          </button>
        )}
      </div>

      <div className="max-h-[26rem] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-fg-4">
            No stones in the safe match that.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {filtered.map((s) => {
                const on = selected.has(s.id);
                return (
                  <tr
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={`cursor-pointer border-b border-line-soft last:border-0 ${
                      on ? "bg-accent-soft/60" : "hover:bg-surface-2"
                    }`}
                  >
                    <td className="w-8 py-1.5 pl-4">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 accent-[var(--accent)]"
                        aria-label={`Select ${s.stoneNo}`}
                      />
                    </td>
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <GemSwatch colour={s.colour} variety={s.variety} size={20} />
                        <span className="font-medium text-fg">{s.stoneNo}</span>
                      </span>
                    </td>
                    <td className="py-1.5 text-fg-2">{s.variety ?? "—"}</td>
                    <td className="tnum py-1.5 text-right text-fg-2">
                      {s.weightCt.toFixed(3)} ct
                    </td>
                    <td className="py-1.5 pr-4 pl-4 text-right text-xs text-fg-4">
                      {s.location ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
