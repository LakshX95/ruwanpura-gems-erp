/**
 * Period filtering for the reports.
 *
 * Only *flow* reports take a date range — sales, jobs completed, parcels cut.
 * Stock on hand and holdings by treatment are *position* reports: they answer
 * "what do I own right now". Filtering those by a period would silently
 * produce a number that means nothing, so they stay as-at-today and say so.
 */
export type Preset =
  | "this-month" | "last-month" | "this-quarter"
  | "this-year" | "last-12" | "all";

export type Range = { from?: Date; to?: Date; label: string; preset: string };

export const PRESETS: { value: Preset; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-quarter", label: "This quarter" },
  { value: "this-year", label: "This year" },
  { value: "last-12", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export function resolveRange(
  preset?: string | null,
  fromStr?: string | null,
  toStr?: string | null,
  now = new Date(),
): Range {
  if (preset === "custom" && (fromStr || toStr)) {
    const from = fromStr ? startOfDay(new Date(fromStr)) : undefined;
    const to = toStr ? endOfDay(new Date(toStr)) : undefined;
    return {
      from,
      to,
      preset: "custom",
      label: `${fromStr ?? "start"} to ${toStr ?? "today"}`,
    };
  }

  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case "last-month":
      return {
        from: new Date(y, m - 1, 1),
        to: endOfDay(new Date(y, m, 0)),
        preset: "last-month",
        label: "Last month",
      };
    case "this-quarter": {
      const q = Math.floor(m / 3) * 3;
      return {
        from: new Date(y, q, 1),
        to: endOfDay(now),
        preset: "this-quarter",
        label: "This quarter",
      };
    }
    case "this-year":
      return {
        from: new Date(y, 0, 1),
        to: endOfDay(now),
        preset: "this-year",
        label: "This year",
      };
    case "last-12":
      return {
        from: new Date(y - 1, m, 1),
        to: endOfDay(now),
        preset: "last-12",
        label: "Last 12 months",
      };
    case "this-month":
      return {
        from: new Date(y, m, 1),
        to: endOfDay(now),
        preset: "this-month",
        label: "This month",
      };
    default:
      return { preset: "all", label: "All time" };
  }
}

/** For interpolating into raw SQL predicates via Prisma.sql fragments. */
export function isoOrNull(d?: Date): string | null {
  return d ? d.toISOString() : null;
}
