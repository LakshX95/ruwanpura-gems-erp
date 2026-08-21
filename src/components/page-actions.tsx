"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Download, Printer, QrCode } from "lucide-react";
import { useToast } from "@/components/toast";

const BTN =
  "inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 " +
  "text-sm font-medium text-fg-2 transition-colors hover:border-fg-5 hover:text-fg print:hidden";

/**
 * Exports carry the page's current filters, so what downloads is what the user
 * is looking at — not the whole table. Getting that wrong is how someone emails
 * their accountant the entire stock register by accident.
 */
export function ExportButton({
  dataset,
  label = "Export CSV",
}: {
  dataset: string;
  label?: string;
}) {
  const params = useSearchParams();
  const toast = useToast();
  const qs = params.toString();
  const href = `/api/export/${dataset}${qs ? `?${qs}` : ""}`;

  return (
    <a
      href={href}
      className={BTN}
      onClick={() => toast("Preparing your download…", "info")}
    >
      <Download size={14} />
      {label}
    </a>
  );
}

/** Opens the label sheet for whatever the current filters select. */
export function LabelsButton({ label = "Labels" }: { label?: string }) {
  const params = useSearchParams();
  const qs = params.toString();
  return (
    <Link href={`/labels${qs ? `?${qs}` : ""}`} className={BTN}>
      <QrCode size={14} />
      {label}
    </Link>
  );
}

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={BTN}>
      <Printer size={14} />
      {label}
    </button>
  );
}

export function PageActions({
  dataset,
  labels = false,
  children,
}: {
  dataset?: string;
  labels?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      {labels && <LabelsButton />}
      {dataset && <ExportButton dataset={dataset} />}
      <PrintButton />
      {children}
    </div>
  );
}
