"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { createStone, type NewStoneState } from "./actions";
import {
  Button, Card, CardHeader, Field, Input, Select, Textarea,
} from "@/components/ui/primitives";
import { GemSwatch } from "@/components/gem";

type Option = { id: string; name: string };
type Defaults = Partial<
  Record<"varietyId" | "shapeId" | "treatmentId" | "locationId" | "origin", string>
>;

export function NewStoneForm({
  varieties,
  shapes,
  colours,
  treatments,
  locations,
  suggestedNo,
  defaults,
  savedNo,
}: {
  varieties: Option[];
  shapes: Option[];
  colours: Option[];
  treatments: Option[];
  locations: Option[];
  suggestedNo: string;
  defaults: Defaults;
  savedNo?: string;
}) {
  const [state, formAction, pending] = useActionState<NewStoneState, FormData>(
    createStone,
    {},
  );
  const [kind, setKind] = useState("STONE");
  const [colourId, setColourId] = useState("");
  const [varietyId, setVarietyId] = useState(defaults.varietyId ?? "");

  const err = (f: string) => state.fieldErrors?.[f];
  const colourName = colours.find((c) => c.id === colourId)?.name;
  const varietyName = varieties.find((v) => v.id === varietyId)?.name;

  return (
    <form action={formAction} className="space-y-4">
      {savedNo && (
        <div className="flex items-center gap-2 rounded-md border border-accent/25 bg-accent-soft px-3 py-2 text-sm text-accent">
          <Check size={15} />
          <span>
            Saved <strong>{savedNo}</strong>. Variety, treatment and tray have been
            kept for the next one.
          </span>
        </div>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Identity" />
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
              <Field label="Stone number" error={err("stoneNo")}>
                <Input name="stoneNo" defaultValue={suggestedNo} required autoFocus />
              </Field>
              <Field label="Type">
                <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="STONE">Individual stone</option>
                  <option value="LOT">Rough parcel (to be sorted)</option>
                  <option value="PARCEL">Bulk goods by weight</option>
                </Select>
              </Field>
              <Field
                label="Weight (ct)"
                error={err("weightCt")}
                hint="1 carat = 0.2 grams"
              >
                <Input
                  name="weightCt"
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="0.000"
                  className="tnum"
                />
              </Field>

              <Field label="Variety" className="sm:col-span-2">
                <Select
                  name="varietyId"
                  value={varietyId}
                  onChange={(e) => setVarietyId(e.target.value)}
                >
                  <option value="">— select —</option>
                  {varieties.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </Select>
              </Field>
              {kind === "PARCEL" ? (
                <Field label="Pieces">
                  <Input name="pieceCount" type="number" min="1" defaultValue={1} className="tnum" />
                </Field>
              ) : (
                <Field label="Shape">
                  <Select name="shapeId" defaultValue={defaults.shapeId ?? ""}>
                    <option value="">— select —</option>
                    {shapes.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Grading" />
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
              <Field label="Colour">
                <Select
                  name="colourId"
                  value={colourId}
                  onChange={(e) => setColourId(e.target.value)}
                >
                  <option value="">— select —</option>
                  {colours.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Treatment"
                hint="Unheated stones carry a large premium — record it accurately"
                className="sm:col-span-2"
              >
                <Select name="treatmentId" defaultValue={defaults.treatmentId ?? ""}>
                  <option value="">— select —</option>
                  {treatments.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Clarity">
                <Input name="clarity" placeholder="Eye clean" list="clarity-options" />
                <datalist id="clarity-options">
                  {["Loupe Clean", "Eye Clean", "Slightly Included", "Included", "Heavily Included"].map(
                    (c) => <option key={c} value={c} />,
                  )}
                </datalist>
              </Field>
              <Field label="Origin" className="sm:col-span-2">
                <Input
                  name="origin"
                  defaultValue={defaults.origin ?? ""}
                  placeholder="Ratnapura, Sri Lanka"
                />
              </Field>

              <Field label="Length (mm)">
                <Input name="lengthMm" type="number" step="0.01" min="0" className="tnum" />
              </Field>
              <Field label="Width (mm)">
                <Input name="widthMm" type="number" step="0.01" min="0" className="tnum" />
              </Field>
              <Field label="Depth (mm)">
                <Input name="depthMm" type="number" step="0.01" min="0" className="tnum" />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Preview" />
            <div className="flex items-center gap-3 px-4 py-4">
              <GemSwatch colour={colourName} variety={varietyName} size={52} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-fg">
                  {varietyName ?? "No variety selected"}
                </div>
                <div className="truncate text-xs text-fg-4">
                  {colourName ?? "No colour selected"}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Where &amp; what it cost" />
            <div className="space-y-3 px-4 py-3">
              <Field label="Location">
                <Select name="locationId" defaultValue={defaults.locationId ?? ""}>
                  <option value="">— select —</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Purchase cost (LKR)"
                error={err("purchaseCost")}
                hint="Optional. Creates the first line of the cost breakdown."
              >
                <Input name="purchaseCost" inputMode="decimal" placeholder="0.00" className="tnum" />
              </Field>
              <Field label="Asking price (LKR)" error={err("askingPrice")}>
                <Input name="askingPrice" inputMode="decimal" placeholder="0.00" className="tnum" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Certificate" />
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
              <Field label="Laboratory">
                <Input name="certLab" placeholder="GRS" list="lab-options" />
                <datalist id="lab-options">
                  {["NGJA", "GIA", "GRS", "Lotus", "SSEF", "AGL"].map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </Field>
              <Field label="Report number">
                <Input name="certNo" className="tnum" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Note" />
            <div className="px-4 py-3">
              <Textarea name="note" rows={3} placeholder="Anything worth remembering" />
            </div>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <Link
          href="/stones"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-fg-3 hover:bg-surface-3"
        >
          Cancel
        </Link>
        <Button
          type="submit"
          name="_again"
          value="1"
          variant="secondary"
          disabled={pending}
        >
          Save &amp; add another
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save stone"}
        </Button>
      </div>
    </form>
  );
}
