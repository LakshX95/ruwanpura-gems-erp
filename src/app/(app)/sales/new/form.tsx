"use client";

import Link from "next/link";
import { useMemo, useState, useActionState } from "react";
import { Search, X } from "lucide-react";
import { createSaleAction, type SaleState } from "../actions";
import {
  Button, Card, CardHeader, Field, Input, Select, Textarea,
} from "@/components/ui/primitives";
import { GemSwatch } from "@/components/gem";
import { formatMoney, formatMoneyShort, parseMoneyToMinor } from "@/lib/format";

export type Sellable = {
  id: string;
  stoneNo: string;
  weightCt: number;
  variety: string | null;
  colour: string | null;
  location: string | null;
  askingPriceMinor: string | null; // serialised bigint
  costMinor: string;
};

type Row = { perCarat: string; total: string };

const toMinor = (s: string): bigint | null => {
  if (!s.trim()) return null;
  try {
    return parseMoneyToMinor(s);
  } catch {
    return null;
  }
};

export function NewSaleForm({
  stones,
  customers,
  showMargin,
}: {
  stones: Sellable[];
  customers: { id: string; name: string }[];
  showMargin: boolean;
}) {
  const [state, formAction, pending] = useActionState<SaleState, FormData>(
    createSaleAction,
    {},
  );
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [currency, setCurrency] = useState("LKR");

  const byId = useMemo(() => new Map(stones.map((s) => [s.id, s])), [stones]);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return stones
      .filter(
        (s) =>
          !picked.includes(s.id) &&
          (s.stoneNo.toLowerCase().includes(n) ||
            (s.variety ?? "").toLowerCase().includes(n)),
      )
      .slice(0, 8);
  }, [q, stones, picked]);

  function add(id: string) {
    const s = byId.get(id)!;
    setPicked((p) => [...p, id]);
    setRows((r) => ({
      ...r,
      // Seed with the asking price so the common case is one keystroke.
      [id]: {
        perCarat: "",
        total: s.askingPriceMinor
          ? (Number(s.askingPriceMinor) / 100).toFixed(2)
          : "",
      },
    }));
    setQ("");
  }

  function remove(id: string) {
    setPicked((p) => p.filter((x) => x !== id));
  }

  function update(id: string, patch: Partial<Row>) {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  }

  /** Whichever of per-carat / total the user typed, derive the other. */
  function lineTotals(id: string) {
    const s = byId.get(id)!;
    const row = rows[id] ?? { perCarat: "", total: "" };
    const per = toMinor(row.perCarat);
    let total = toMinor(row.total);
    if (total == null && per != null) {
      total = BigInt(Math.round(Number(per) * s.weightCt));
    }
    const derivedPer =
      per ?? (total != null && s.weightCt > 0
        ? BigInt(Math.round(Number(total) / s.weightCt))
        : null);
    return { total, perCarat: derivedPer, cost: BigInt(s.costMinor) };
  }

  const totals = picked.reduce(
    (acc, id) => {
      const { total, cost } = lineTotals(id);
      return {
        revenue: acc.revenue + (total ?? 0n),
        cost: acc.cost + cost,
        weight: acc.weight + byId.get(id)!.weightCt,
      };
    },
    { revenue: 0n, cost: 0n, weight: 0 },
  );
  const margin = totals.revenue - totals.cost;
  const marginPct =
    totals.revenue > 0n ? (Number(margin) / Number(totals.revenue)) * 100 : 0;

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
        <CardHeader title="Sale details" />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-5">
          <Field label="Customer" className="sm:col-span-2">
            <Select name="customerId" required defaultValue="">
              <option value="" disabled>— choose —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date of sale">
            <Input
              name="soldOn"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Currency">
            <Select
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {["LKR", "USD", "EUR", "THB", "HKD"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field
            label="Rate to LKR"
            hint={currency === "LKR" ? "Not needed" : "Rate on the day"}
          >
            <Input
              name="fxRate"
              type="number"
              step="0.0001"
              min="0.0001"
              required
              defaultValue={1}
              // readOnly, not disabled: a disabled input is omitted from the
              // form data entirely, which failed validation on every LKR sale.
              readOnly={currency === "LKR"}
              key={currency}
              className={currency === "LKR" ? "tnum bg-surface-3" : "tnum"}
            />
          </Field>

          <Field label="Broker (if any)" className="sm:col-span-2">
            <Input name="brokerName" placeholder="Name of the introducing broker" />
          </Field>
          <Field label="Note" className="sm:col-span-3">
            <Textarea name="note" rows={1} />
          </Field>
        </div>
      </Card>

      <Card className="overflow-visible">
        <CardHeader
          title="Stones sold"
          action={
            <span className="text-xs text-fg-4">
              Only stones in the safe can be sold
            </span>
          }
        />

        <div className="relative border-b border-line px-4 py-2.5">
          <Search
            size={14}
            className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-fg-4"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a stone number or variety to add…"
            className="pl-7"
          />
          {results.length > 0 && (
            <ul className="absolute left-4 right-4 top-full z-10 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-[var(--shadow-pop)]">
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => add(s.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent-soft"
                  >
                    <GemSwatch colour={s.colour} variety={s.variety} size={18} />
                    <span className="font-medium text-fg">{s.stoneNo}</span>
                    <span className="text-fg-3">{s.variety}</span>
                    <span className="tnum ml-auto text-fg-3">
                      {s.weightCt.toFixed(3)} ct
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {picked.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-4">
            No stones added yet. Search above to add the first one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-fg-3">
                  <th className="px-4 py-2 font-semibold">Stone</th>
                  <th className="px-3 py-2 text-right font-semibold">Weight</th>
                  <th className="px-3 py-2 text-right font-semibold">Per carat</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  {showMargin && (
                    <>
                      <th className="px-3 py-2 text-right font-semibold">Cost</th>
                      <th className="px-3 py-2 text-right font-semibold">Margin</th>
                    </>
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {picked.map((id) => {
                  const s = byId.get(id)!;
                  const row = rows[id] ?? { perCarat: "", total: "" };
                  const { total, perCarat, cost } = lineTotals(id);
                  const m = total != null ? total - cost : null;
                  return (
                    <tr key={id} className="border-b border-line-soft last:border-0">
                      <td className="px-4 py-1.5">
                        <input type="hidden" name="stoneIds" value={id} />
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <GemSwatch colour={s.colour} variety={s.variety} size={20} />
                          <span className="font-medium text-fg">{s.stoneNo}</span>
                          <span className="text-xs text-fg-4">{s.variety}</span>
                        </span>
                      </td>
                      <td className="tnum px-3 py-1.5 text-right text-fg-2">
                        {s.weightCt.toFixed(3)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Input
                          name={`perCarat_${id}`}
                          inputMode="decimal"
                          value={row.perCarat}
                          onChange={(e) =>
                            update(id, { perCarat: e.target.value, total: "" })
                          }
                          placeholder={
                            perCarat != null
                              ? (Number(perCarat) / 100).toFixed(2)
                              : "0.00"
                          }
                          className="tnum w-28 text-right"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Input
                          name={`total_${id}`}
                          inputMode="decimal"
                          value={row.total}
                          onChange={(e) =>
                            update(id, { total: e.target.value, perCarat: "" })
                          }
                          placeholder={
                            total != null ? (Number(total) / 100).toFixed(2) : "0.00"
                          }
                          className="tnum w-32 text-right"
                        />
                      </td>
                      {showMargin && (
                        <>
                          <td className="tnum px-3 py-1.5 text-right text-fg-3">
                            {formatMoneyShort(cost)}
                          </td>
                          <td className="tnum px-3 py-1.5 text-right">
                            {m == null ? (
                              <span className="text-fg-5">—</span>
                            ) : (
                              <span
                                className={
                                  m >= 0n
                                    ? "font-medium text-accent"
                                    : "font-medium text-danger"
                                }
                              >
                                {formatMoneyShort(m)}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => remove(id)}
                          className="rounded p-1 text-fg-4 hover:bg-surface-3 hover:text-danger"
                          aria-label={`Remove ${s.stoneNo}`}
                        >
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2 font-medium">
                  <td className="px-4 py-2 text-fg-2">
                    {picked.length} stone{picked.length === 1 ? "" : "s"}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-fg">
                    {totals.weight.toFixed(3)}
                  </td>
                  <td />
                  <td className="tnum px-3 py-2 text-right text-fg">
                    {formatMoney(totals.revenue, currency)}
                  </td>
                  {showMargin && (
                    <>
                      <td className="tnum px-3 py-2 text-right text-fg-3">
                        {formatMoneyShort(totals.cost)}
                      </td>
                      <td className="tnum px-3 py-2 text-right">
                        <span
                          className={margin >= 0n ? "text-accent" : "text-danger"}
                        >
                          {formatMoneyShort(margin)}
                          <span className="ml-1 text-xs font-normal text-fg-4">
                            {marginPct.toFixed(0)}%
                          </span>
                        </span>
                      </td>
                    </>
                  )}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-2 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <Link
          href="/sales"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-fg-3 hover:bg-surface-3"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending || picked.length === 0}>
          {pending ? "Recording…" : "Record sale"}
        </Button>
      </div>
    </form>
  );
}
