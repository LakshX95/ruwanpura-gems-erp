import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { StoneStatus, StoneKind } from "@/generated/prisma/enums";

/**
 * A colour swatch standing in for a photograph.
 *
 * Photo capture is a later item on the plan, but a stone list with no visual
 * is much harder to scan — and the trade thinks in colour first. Deriving a
 * gradient from the recorded colour gives the list its shape now, and the
 * component is replaced by the real thumbnail when uploads land.
 */
const COLOUR_MAP: [RegExp, string, string][] = [
  [/pigeon blood|vivid red|^red/i, "#a11224", "#5d0a15"],
  [/hot pink|vivid pink/i, "#d8407f", "#8e1f4f"],
  [/pink-orange|padparadscha/i, "#f08a5d", "#c94f2e"],
  [/canary|golden yellow|yellow/i, "#e8b83a", "#a8801a"],
  [/royal blue/i, "#1f3f8f", "#101f4d"],
  [/cornflower/i, "#5578c4", "#2f4a86"],
  [/vivid blue/i, "#1660b5", "#0c3a70"],
  [/pastel blue/i, "#9dbbdf", "#6a8cb5"],
  [/greenish blue|peacock/i, "#1f8a8a", "#0f5252"],
  [/grey-blue|grey/i, "#7c8a99", "#4c5763"],
  [/honey/i, "#c89043", "#8c6021"],
  [/colourless|white/i, "#e6e8ea", "#b6bcc2"],
];

function swatchColours(colour?: string | null, variety?: string | null) {
  const subject = `${colour ?? ""} ${variety ?? ""}`;
  for (const [re, from, to] of COLOUR_MAP) {
    if (re.test(subject)) return { from, to };
  }
  return { from: "#8f9aa6", to: "#5b6570" };
}

export function GemSwatch({
  colour,
  variety,
  size = 32,
  className,
}: {
  colour?: string | null;
  variety?: string | null;
  size?: number;
  className?: string;
}) {
  const { from, to } = swatchColours(colour, variety);
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-full ring-1 ring-black/10", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 28%, #ffffffbb 0%, ${from} 42%, ${to} 100%)`,
      }}
    />
  );
}

/* ------------------------------------------------------------------ status */

const STATUS: Record<StoneStatus, { label: string; tone: Parameters<typeof Badge>[0]["tone"] }> = {
  IN_STOCK: { label: "In stock", tone: "green" },
  OUT: { label: "Out", tone: "amber" },
  SOLD: { label: "Sold", tone: "blue" },
  WRITTEN_OFF: { label: "Written off", tone: "red" },
  CONSUMED: { label: "Split", tone: "neutral" },
};

export function StatusBadge({ status }: { status: StoneStatus }) {
  const s = STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const KIND: Record<StoneKind, string> = {
  LOT: "Parcel",
  STONE: "Stone",
  PARCEL: "Bulk",
};

export function KindBadge({ kind }: { kind: StoneKind }) {
  return (
    <Badge tone={kind === "LOT" ? "gold" : "neutral"}>{KIND[kind]}</Badge>
  );
}

/**
 * Treatment is the single most commercially significant attribute on a stone —
 * "unheated" can be worth multiples of the same stone heated. It gets visual
 * weight, and it must never be silently absent.
 */
const TREATMENT_SHORT: Record<string, string> = {
  "None (Unheated)": "Unheated",
  "Heated, minor residue": "Heat + residue",
  "Fissure-filled": "Filled",
};

export function TreatmentBadge({ treatment }: { treatment?: string | null }) {
  if (!treatment) return <span className="text-fg-5">—</span>;
  const unheated = /^none/i.test(treatment);
  return (
    <Badge tone={unheated ? "gold" : "neutral"} className="whitespace-nowrap">
      {TREATMENT_SHORT[treatment] ?? treatment}
    </Badge>
  );
}
