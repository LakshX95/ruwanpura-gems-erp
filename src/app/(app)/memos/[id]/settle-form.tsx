"use client";

import { useActionState, useState } from "react";
import { settleMemoAction, type MemoState } from "../actions";
import {
  Button, Card, CardHeader, Field, Input, Select,
} from "@/components/ui/primitives";
import { GemSwatch } from "@/components/gem";
import { formatMoney, formatMoneyShort, parseMoneyToMinor } from "@/lib/format";
import type { MemoDetail } from "@/lib/queries/memos";

type Row = { outcome: string; price: string };

const toMinor = (s: string): bigint | null => {
  if (!s.trim()) return null;
  try {
    return parseMoneyToMinor(s);
  } catch {
    return null;
  }
};

/**
 * Settling a memo. Partial settlement is the normal case — a dealer returns
 * four of six and keeps two a while longer — so every line defaults to
 * "still out" and only what is explicitly changed gets acted on.
 */
export function SettleMemoForm({
  memo,
  locations,
  showCost,
}: {
  memo: MemoDetail;
  locations: { id: string; name: string }[];
  showCost: boolean;
}) {
  const [state, formAction, pending] = useActionState<MemoState, FormData>(
    settleMemoAction,
    {},
  );
  const open = memo.lines.filter((l) => l.outcome === null);
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      open.map((l) => [
        l.id,
        {
          outcome: "KEEP",
          price: l.quotedPriceMinor
            ? (Number(l.quotedPriceMinor) / 100).toFixed(2)
            : "",
        },
      ]),
    ),
  );

  const update = (id: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const acting = open.filter((l) => rows[l.id]?.outcome !== "KEEP");
  const soldTotal = open.reduce((a, l) => {
    const r = rows[l.id];
    if (r?.outcome !== "SOLD") return a;
    return a + (toMinor(r.price) ?? 0n);
  }, 0n);

  if (open.length === 0) return null;

  return (
    <form action={formAction}>
      <input type="hidden" name="memoId" value={memo.id} />

      <Card className="overflow-hidden">
        <CardHeader
          title="Settle what has come back"
          action={
            <span className="text-xs text-fg-4">
              Leave a stone as “still out” to keep it on memo
            </span>
          }
        />

        {state.error && (
          <p
            role="alert"
            className="border-b border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger"
          >
            {state.error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-surface-2">
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-3">
                <th className="px-4 py-2 font-semibold">Stone</th>
                <th className="px-3 py-2 text-right font-semibold">Weight</th>
                <th className="px-3 py-2 text-right font-semibold">Quoted</th>
                {showCost && (
                  <th className="px-3 py-2 text-right font-semibold">Cost</th>
                )}
                <th className="px-3 py-2 font-semibold">What happened</th>
                <th className="px-4 py-2 text-right font-semibold">Sale price</th>
              </tr>
            </thead>
            <tbody>
              {open.map((l) => {
                const r = rows[l.id];
                const sold = r?.outcome === "SOLD";
                return (
                  <tr key={l.id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-1.5">
                      <input type="hidden" name="lineIds" value={l.id} />
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        {l.thumbUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`/api/media/file/${l.thumbUrl}`}
                            alt=""
                            className="h-5 w-5 rounded-full object-cover ring-1 ring-black/10"
                          />
                        ) : (
                          <GemSwatch colour={l.colour} variety={l.variety} size={20} />
                        )}
                        <span className="font-medium text-fg">{l.stoneNo}</span>
                        <span className="text-xs text-fg-4">{l.variety}</span>
                      </span>
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {l.weightOutCt.toFixed(3)}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-3">
                      {formatMoneyShort(l.quotedPriceMinor)}
                    </td>
                    {showCost && (
                      <td className="tnum px-3 py-1.5 text-right text-fg-3">
                        {formatMoneyShort(l.costMinor)}
                      </td>
                    )}
                    <td className="px-3 py-1.5">
                      <Select
                        name={`outcome_${l.id}`}
                        value={r?.outcome ?? "KEEP"}
                        onChange={(e) => update(l.id, { outcome: e.target.value })}
                        className="w-40"
                      >
                        <option value="KEEP">Still out</option>
                        <option value="RETURNED">Returned</option>
                        <option value="SOLD">Sold</option>
                        <option value="LOST">Not returned</option>
                      </Select>
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <Input
                        name={`price_${l.id}`}
                        inputMode="decimal"
                        disabled={!sold}
                        value={sold ? r.price : ""}
                        onChange={(e) => update(l.id, { price: e.target.value })}
                        placeholder={sold ? "0.00" : "—"}
                        className="tnum w-32 text-right"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line px-4 py-3">
          <Field label="Returned stones go back to" className="w-64">
            <Select name="returnLocationId" defaultValue={locations[0]?.id ?? ""}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center gap-4">
            {soldTotal > 0n && (
              <span className="text-sm text-fg-3">
                Sale total{" "}
                <span className="tnum font-semibold text-fg">
                  {formatMoney(soldTotal)}
                </span>
              </span>
            )}
            <Button type="submit" disabled={pending || acting.length === 0}>
              {pending
                ? "Saving…"
                : acting.length === 0
                  ? "Nothing to settle"
                  : `Settle ${acting.length} stone${acting.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </Card>

      <p className="mt-2 text-xs text-fg-4">
        Stones marked sold create a sale record, so margin and the sales
        register stay complete. Stones marked “not returned” are written off.
      </p>
    </form>
  );
}
