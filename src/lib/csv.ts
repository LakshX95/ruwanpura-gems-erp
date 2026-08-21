/**
 * CSV generation for the export endpoints.
 *
 * Excel is the destination for every one of these files, so: a UTF-8 BOM so
 * Sinhala and Tamil party names survive, CRLF line endings, and money written
 * as a plain decimal in its own column rather than a formatted string — a
 * spreadsheet cannot sum "LKR 1,850,000.00".
 */

export type Column<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function escapeCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((r) =>
    columns.map((c) => escapeCell(c.value(r))).join(","),
  );
  return "﻿" + [head, ...body].join("\r\n") + "\r\n";
}

/** BigInt minor units -> "1850000.00" for a numeric spreadsheet column. */
export function minorToDecimal(v: bigint | null | undefined): string {
  if (v == null) return "";
  const neg = v < 0n;
  const abs = neg ? -v : v;
  return `${neg ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** yyyy-mm-dd, for filenames. */
export function stamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
