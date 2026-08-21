"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "ruwanpura-theme";

/**
 * Applied before first paint by the inline script in the root layout, so the
 * page never flashes the wrong theme. This component only handles changes.
 */
export function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Runs before hydration. Kept tiny and dependency-free on purpose. */
export const themeScript = `(function(){try{
var c=localStorage.getItem("${KEY}")||"system";
var d=c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.dataset.theme=d?"dark":"light";
document.documentElement.dataset.sidebar=
  localStorage.getItem("ruwanpura-sidebar")==="1"?"collapsed":"open";
}catch(e){document.documentElement.dataset.theme="light";}})();`;

/** Notifies every subscriber that a stored preference changed. */
const CHANGED = "ruwanpura-pref-change";

function subscribe(cb: () => void) {
  window.addEventListener(CHANGED, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGED, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * localStorage is an external store, so it is read through
 * useSyncExternalStore rather than copied into state inside an effect.
 */
function useStoredTheme(): ThemeChoice {
  return useSyncExternalStore(
    subscribe,
    () => (localStorage.getItem(KEY) as ThemeChoice) ?? "system",
    () => "system" as ThemeChoice,
  );
}

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const choice = useStoredTheme();

  // Following the OS is a subscription to an external system, which is exactly
  // what an effect is for.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) ?? "system") === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function choose(next: ThemeChoice) {
    localStorage.setItem(KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGED));
  }

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn(
        "inline-flex rounded-md border border-line bg-surface-2 p-0.5",
        compact && "scale-95",
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          aria-pressed={choice === value}
          title={label}
          className={cn(
            "rounded p-1 transition-colors",
            choice === value
              ? "bg-surface text-fg shadow-[var(--shadow-card)]"
              : "text-fg-4 hover:text-fg-2",
          )}
        >
          <Icon size={13} strokeWidth={2.2} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
