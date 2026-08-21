"use client";

import { useActionState, useState } from "react";
import { receiveJobAction, type JobState } from "../actions";
import {
  Button, Card, CardHeader, Field, Input, Select,
} from "@/components/ui/primitives";
import { GemSwatch } from "@/components/gem";
import type { JobDetail } from "@/lib/queries/jobs";

type Row = { weightIn: string; outcome: string; charge: string };

/**
 * Taking a job back in.
 *
 * Yield is shown live per line and in total, because that number is the reason
 * the vendor conversation happens — and it needs to be visible while the
 * stones are still on the counter, not in a report next month.
 */
export function ReceiveForm({
  job,
  locations,
}: {
  job: JobDetail;
  locations: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<JobState, FormData>(
    receiveJobAction,
    {},
  );
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      job.lines.map((l) => [
        l.id,
        {
          // Heat and lab work do not change weight, so pre-fill and let the
          // clerk correct it. Cutting must be entered deliberately.
          weightIn: job.kind === "CUTTING" ? "" : l.weightOutCt.toFixed(3),
          outcome: "RETURNED",
          charge: "",
        },
      ]),
    ),
  );

  const update = (id: string, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const totals = job.lines.reduce(
    (acc, l) => {
      const r = rows[l.id];
      const lost = r.outcome === "LOST" || r.outcome === "BROKEN";
      const win = lost ? 0 : Number(r.weightIn || 0);
      return {
        out: acc.out + l.weightOutCt,
        in: acc.in + win,
        lost: acc.lost + (lost ? 1 : 0),
      };
    },
    { out: 0, in: 0, lost: 0 },
  );
  const totalYield = totals.out > 0 ? (totals.in / totals.out) * 100 : 0;

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={job.id} />

      <Card className="overflow-hidden">
        <CardHeader
          title="Receive the stones back"
          action={
            <span className="text-sm">
              <span className="text-fg-3">Total yield </span>
              <span
                className={`tnum font-semibold ${
                  totalYield >= 80
                    ? "text-accent"
                    : totalYield >= 65
                      ? "text-fg"
                      : "text-warn"
                }`}
              >
                {totalYield.toFixed(1)}%
              </span>
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
                <th className="px-3 py-2 text-right font-semibold">Weight out</th>
                <th className="px-3 py-2 text-right font-semibold">Weight back</th>
                <th className="px-3 py-2 text-right font-semibold">Yield</th>
                <th className="px-3 py-2 font-semibold">Outcome</th>
                <th className="px-4 py-2 text-right font-semibold">Charge (LKR)</th>
              </tr>
            </thead>
            <tbody>
              {job.lines.map((l) => {
                const r = rows[l.id];
                const lost = r.outcome === "LOST" || r.outcome === "BROKEN";
                const win = Number(r.weightIn || 0);
                const pct = !lost && win > 0 ? (win / l.weightOutCt) * 100 : null;
                const heavier = win > l.weightOutCt + 0.0005;
                return (
                  <tr key={l.id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-1.5">
                      <input type="hidden" name="lineIds" value={l.id} />
                      <span className="flex items-center gap-2">
                        <GemSwatch colour={l.colour} variety={l.variety} size={20} />
                        <span className="font-medium text-fg">{l.stoneNo}</span>
                        <span className="text-xs text-fg-4">{l.variety}</span>
                      </span>
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-fg-2">
                      {l.weightOutCt.toFixed(3)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Input
                        name={`weightIn_${l.id}`}
                        type="number"
                        step="0.001"
                        min="0"
                        disabled={lost}
                        value={lost ? "" : r.weightIn}
                        onChange={(e) => update(l.id, { weightIn: e.target.value })}
                        className={`tnum w-24 text-right ${
                          heavier ? "border-danger bg-danger-soft" : ""
                        }`}
                        placeholder="0.000"
                      />
                    </td>
                    <td className="tnum px-3 py-1.5 text-right">
                      {heavier ? (
                        <span className="text-xs font-medium text-danger">
                          heavier?
                        </span>
                      ) : pct == null ? (
                        <span className="text-fg-5">—</span>
                      ) : (
                        <span
                          className={
                            pct >= 80
                              ? "font-medium text-accent"
                              : pct >= 65
                                ? "text-fg"
                                : "font-medium text-warn"
                          }
                        >
                          {pct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <Select
                        name={`outcome_${l.id}`}
                        value={r.outcome}
                        onChange={(e) => update(l.id, { outcome: e.target.value })}
                        className="w-40"
                      >
                        <option value="RETURNED">Returned</option>
                        <option value="REJECTED">Rejected by vendor</option>
                        <option value="LOST">Lost in treatment</option>
                        <option value="BROKEN">Broken</option>
                      </Select>
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <Input
                        name={`charge_${l.id}`}
                        inputMode="decimal"
                        value={r.charge}
                        onChange={(e) => update(l.id, { charge: e.target.value })}
                        className="tnum w-28 text-right"
                        placeholder="0.00"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 font-medium">
                <td className="px-4 py-2 text-fg-2">
                  {job.lines.length} {job.lines.length === 1 ? "stone" : "stones"}
                  {totals.lost > 0 && (
                    <span className="ml-2 text-danger">
                      {totals.lost} written off
                    </span>
                  )}
                </td>
                <td className="tnum px-3 py-2 text-right text-fg">
                  {totals.out.toFixed(3)}
                </td>
                <td className="tnum px-3 py-2 text-right text-fg">
                  {totals.in.toFixed(3)}
                </td>
                <td className="tnum px-3 py-2 text-right text-fg">
                  {totalYield.toFixed(1)}%
                </td>
                <td colSpan={2} className="px-4 py-2 text-right text-xs text-fg-3">
                  {(totals.out - totals.in).toFixed(3)} ct lost
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line px-4 py-3">
          <Field label="Return to" className="w-64">
            <Select name="returnLocationId" defaultValue={locations[0]?.id ?? ""}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Receiving…" : "Receive & close job"}
          </Button>
        </div>
      </Card>

      <p className="mt-2 text-xs text-fg-4">
        Charges are posted to each stone&rsquo;s cost breakdown. A stone marked
        lost or broken is written off, and the vendor charge still applies —
        which is normally what the agreement says.
      </p>
    </form>
  );
}
