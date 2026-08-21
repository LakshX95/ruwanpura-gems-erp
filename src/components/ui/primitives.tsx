import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium " +
  "transition-colors disabled:pointer-events-none disabled:opacity-50 " +
  "whitespace-nowrap px-3 py-1.5";
const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary:
    "bg-surface text-fg-2 border border-line hover:bg-surface-2 hover:border-fg-5",
  ghost: "text-fg-2 hover:bg-surface-3 hover:text-fg",
  danger: "bg-danger text-white hover:bg-danger",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], className)} {...props} />
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], className)} {...props} />
  );
}

/* ------------------------------------------------------------------ fields */

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-xs font-semibold text-fg-2 mb-1", className)}
      {...props}
    />
  );
}

const FIELD =
  "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm " +
  "text-fg placeholder:text-fg-4 focus:border-accent " +
  "focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-surface-3";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD, "pr-8", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, "min-h-16", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-fg-4">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------- cards */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-line px-4 py-2.5",
        className,
      )}
    >
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ badges */

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "gold";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface-3 text-fg-2 ring-line",
  green: "bg-accent-soft text-accent ring-accent/25",
  amber: "bg-warn-soft text-warn ring-warn/25",
  red: "bg-danger-soft text-danger ring-danger/25",
  blue: "bg-info-soft text-info ring-info/25",
  gold: "bg-gold-soft text-gold ring-gold/25",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------- misc */

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-16 text-center">
      <p className="text-sm font-medium text-fg-2">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-fg-4">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Shown in place of cost figures for roles that may not see them. */
export function Restricted() {
  return <span className="text-fg-5 select-none">••••</span>;
}
