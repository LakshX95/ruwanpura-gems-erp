"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes, FileOutput, Gem, Hammer, LayoutDashboard, Plus, Receipt, Search,
  QrCode, ShoppingCart, Truck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { GemSwatch } from "@/components/gem";

type Cmd = { label: string; hint?: string; href: string; Icon: typeof Gem };

const COMMANDS: Cmd[] = [
  { label: "Dashboard", href: "/", Icon: LayoutDashboard },
  { label: "Stones", href: "/stones", Icon: Gem },
  { label: "Add a stone", hint: "New", href: "/stones/new", Icon: Plus },
  { label: "Jobs", href: "/jobs", Icon: Hammer },
  { label: "Send stones out", hint: "New job", href: "/jobs/new", Icon: Plus },
  { label: "On memo", href: "/memos", Icon: FileOutput },
  { label: "Send on memo", hint: "New", href: "/memos/new", Icon: Plus },
  { label: "Sales", href: "/sales", Icon: Receipt },
  { label: "Record a sale", hint: "New", href: "/sales/new", Icon: Plus },
  { label: "Purchases", href: "/purchases", Icon: ShoppingCart },
  { label: "Where is it", href: "/custody", Icon: Truck },
  { label: "Reports", href: "/reports", Icon: Boxes },
  { label: "Packet labels", hint: "QR", href: "/labels", Icon: QrCode },
];

type Hit = {
  id: string; stoneNo: string; weightCt: number;
  variety: string | null; colour: string | null;
};

/**
 * Ctrl/Cmd-K to jump anywhere or find a stone by number. On a system where the
 * daily question is "where is stone X", getting to it in two keystrokes
 * matters more than any amount of navigation chrome.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((wasOpen) => {
          // Reset here rather than in an effect watching `open`: the state
          // belongs to the act of opening, not to a later render pass.
          if (!wasOpen) {
            setQ("");
            setHits([]);
            setActive(0);
          }
          return !wasOpen;
        });
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced so typing a stone number does not fire a request per keystroke.
  useEffect(() => {
    const term = q.trim();
    let cancelled = false;
    const t = setTimeout(async () => {
      if (term.length < 2) {
        if (!cancelled) setHits([]);
        return;
      }
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = await r.json();
        if (!cancelled) setHits(data.stones ?? []);
      } catch {
        if (!cancelled) setHits([]);
      }
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const filteredCommands = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(n));
  }, [q]);

  const rows = useMemo(
    () => [
      ...filteredCommands.map((c) => ({ kind: "cmd" as const, ...c })),
      ...hits.map((h) => ({ kind: "stone" as const, ...h })),
    ],
    [filteredCommands, hits],
  );

  function go(i: number) {
    const row = rows[i];
    if (!row) return;
    setOpen(false);
    router.push(row.kind === "cmd" ? row.href : `/stones/${row.id}`);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="anim-pop w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={15} className="shrink-0 text-fg-4" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, rows.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(active);
              }
            }}
            placeholder="Go to a page, or find a stone by number…"
            className="w-full bg-transparent py-3 text-sm text-fg outline-none placeholder:text-fg-4"
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-fg-4">
            esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {rows.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-fg-4">
              Nothing matches “{q}”.
            </p>
          )}
          {rows.map((row, i) => (
            <button
              key={row.kind === "cmd" ? row.href : row.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(i)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
                i === active ? "bg-accent-soft text-fg" : "text-fg-2",
              )}
            >
              {row.kind === "cmd" ? (
                <>
                  <row.Icon size={15} className="shrink-0 text-fg-4" />
                  <span className="flex-1">{row.label}</span>
                  {row.hint && (
                    <span className="text-xs text-fg-4">{row.hint}</span>
                  )}
                </>
              ) : (
                <>
                  <GemSwatch colour={row.colour} variety={row.variety} size={18} />
                  <span className="flex-1 font-medium">{row.stoneNo}</span>
                  <span className="text-xs text-fg-4">
                    {row.variety} · <span className="tnum">{row.weightCt.toFixed(3)} ct</span>
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
