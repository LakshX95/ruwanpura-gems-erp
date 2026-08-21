/**
 * Money is stored as BigInt minor units (cents) with an explicit currency, and
 * weights as Decimal carats. Both must be converted deliberately at the edges —
 * neither BigInt nor Prisma's Decimal survives serialisation to a client
 * component, and neither should ever become a JS float mid-calculation.
 */

export const MINOR_UNITS = 100n;

/** LKR 1,234,567.89 -> "1,234,567.89" (no symbol; callers add it) */
export function formatMinor(minor: bigint | null | undefined): string {
  if (minor == null) return "—";
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / MINOR_UNITS;
  const frac = abs % MINOR_UNITS;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${wholeStr}.${frac.toString().padStart(2, "0")}`;
}

export function formatMoney(
  minor: bigint | null | undefined,
  currency = "LKR",
): string {
  if (minor == null) return "—";
  return `${currency} ${formatMinor(minor)}`;
}

/** Compact form for dense tables: LKR 1.23M / 456.7K */
export function formatMoneyShort(
  minor: bigint | null | undefined,
  currency = "LKR",
): string {
  if (minor == null) return "—";
  const major = Number(minor / MINOR_UNITS);
  if (Math.abs(major) >= 1_000_000)
    return `${currency} ${(major / 1_000_000).toFixed(2)}M`;
  if (Math.abs(major) >= 1_000)
    return `${currency} ${(major / 1_000).toFixed(1)}K`;
  return `${currency} ${major.toLocaleString("en-LK")}`;
}

/** "1250.50" -> 125050n. Throws on anything that is not a plain decimal. */
export function parseMoneyToMinor(input: string): bigint {
  const cleaned = input.replace(/[,\s]/g, "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Not a valid amount: "${input}"`);
  }
  const negative = cleaned.startsWith("-");
  const [whole, frac = ""] = cleaned.replace("-", "").split(".");
  const minor = BigInt(whole) * MINOR_UNITS + BigInt(frac.padEnd(2, "0"));
  return negative ? -minor : minor;
}

/** Carats always show three decimals — the trade reads 3.120, not 3.12. */
export function formatCt(weight: number | string | null | undefined): string {
  if (weight == null) return "—";
  return `${Number(weight).toFixed(3)} ct`;
}

export function formatMm(v: number | string | null | undefined): string {
  if (v == null) return "—";
  return Number(v).toFixed(2);
}

/**
 * Per-carat price, which is how the trade quotes everything.
 * Total = per-carat price x weight.
 */
export function perCaratMinor(
  totalMinor: bigint,
  weightCt: number,
): bigint | null {
  if (!weightCt) return null;
  return BigInt(Math.round(Number(totalMinor) / weightCt));
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysSince(d: Date | string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}
