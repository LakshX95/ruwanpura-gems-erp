"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes, ChevronsLeft, ChevronsRight, Gem, Hammer, LayoutDashboard,
  FileOutput, LogOut, Receipt, Search, ShoppingCart, Truck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme";

const LINKS = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/stones", label: "Stones", Icon: Gem },
  { href: "/jobs", label: "Jobs", Icon: Hammer },
  { href: "/memos", label: "On memo", Icon: FileOutput },
  { href: "/sales", label: "Sales", Icon: Receipt },
  { href: "/purchases", label: "Purchases", Icon: ShoppingCart },
  { href: "/custody", label: "Where is it", Icon: Truck },
  { href: "/reports", label: "Reports", Icon: Boxes },
];

const KEY = "ruwanpura-sidebar";

/**
 * Collapse is stored on <html> by the pre-paint script and driven entirely by
 * CSS, so there is no React state to hydrate and no flash of the wrong width.
 */
function toggleCollapsed() {
  const root = document.documentElement;
  const next = root.dataset.sidebar === "collapsed" ? "open" : "collapsed";
  root.dataset.sidebar = next;
  localStorage.setItem(KEY, next === "collapsed" ? "1" : "0");
}

/**
 * A narrow rail rather than a wide drawer: the tables in this app are the
 * point, and every pixel the navigation takes is a column the user loses.
 * Collapses to icons for anyone working on a small laptop.
 */
export function Sidebar({
  userName,
  roleLabel,
  signOut,
}: {
  userName: string;
  roleLabel: string;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-14 items-center gap-2 px-3">
        <span
          aria-hidden
          className="inline-block h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, #ffffffcc 0%, #1f3f8f 42%, #101f4d 100%)",
          }}
        />
        <span className="sidebar-wide truncate text-sm font-semibold tracking-tight text-fg">
          Ruwanpura Gems
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {LINKS.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "sidebar-item flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-fg-3 hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon size={16} strokeWidth={2} className="shrink-0" />
              <span className="sidebar-wide truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-line-soft p-2">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
            )
          }
          title="Search — Ctrl+K"
          className="sidebar-item flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-xs text-fg-4 hover:border-fg-5 hover:text-fg-2"
        >
          <Search size={13} className="shrink-0" />
          <span className="sidebar-wide flex-1 text-left">Search</span>
          <kbd className="sidebar-wide rounded border border-line px-1 text-[10px]">
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="sidebar-wide min-w-0 leading-tight">
            <div className="truncate text-xs font-medium text-fg">{userName}</div>
            <div className="truncate text-[11px] text-fg-4">{roleLabel}</div>
          </div>
          <ThemeToggle compact />
        </div>

        <div className="flex gap-1">
          <form action={signOut} className="flex-1">
            <button
              type="submit"
              title="Sign out"
              className="sidebar-item flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-fg-4 hover:bg-surface-2 hover:text-fg"
            >
              <LogOut size={13} className="shrink-0" />
              <span className="sidebar-wide">Sign out</span>
            </button>
          </form>
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Collapse or expand"
            className="rounded-md p-1.5 text-fg-4 hover:bg-surface-2 hover:text-fg"
          >
            <ChevronsLeft size={13} className="sidebar-wide" />
            <ChevronsRight size={13} className="sidebar-narrow" />
          </button>
        </div>
      </div>
    </aside>
  );
}
