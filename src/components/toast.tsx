"use client";

import {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; message: string };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const ICON = { success: Check, error: AlertTriangle, info: Info };
const TONE_CLASS: Record<Tone, string> = {
  success: "border-accent/30 bg-accent-soft text-accent",
  error: "border-danger/30 bg-danger-soft text-danger",
  info: "border-line bg-surface text-fg-2",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
      >
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div
              key={t.id}
              className={cn(
                "anim-in pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-[var(--shadow-pop)]",
                TONE_CLASS[t.tone],
              )}
            >
              <Icon size={15} className="mt-0.5 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                className="shrink-0 opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Server actions redirect rather than return, so success messages travel in the
 * URL. This picks them up once and hands them to the toast stack.
 */
export function FlashToasts() {
  const params = useSearchParams();
  const push = useToast();
  const flash = params.get("flash");
  const tone = (params.get("tone") as Tone | null) ?? "success";

  useEffect(() => {
    if (!flash) return;
    push(flash, tone);
    const url = new URL(window.location.href);
    url.searchParams.delete("flash");
    url.searchParams.delete("tone");
    window.history.replaceState({}, "", url.toString());
  }, [flash, tone, push]);

  return null;
}
