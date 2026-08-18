"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  ListChecks,
  CalendarDays,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Settings stays reachable from the topbar's account menu on every screen
// size, so the bottom row keeps to what a phone screen has room for: the
// three tabs the product prototype itself uses (Home, Scan, Calendar) plus
// the desktop app's archive and task list either side of them.
const SIDE_ITEMS = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
] as const;

const TRAILING_ITEMS = [
  { label: "Archive", href: "/documents", icon: FolderOpen },
  { label: "Tasks", href: "/tasks", icon: ListChecks },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5 items-center">
        {SIDE_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px] font-medium",
                isActive(item.href) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" strokeWidth={1.75} />
              {item.label}
            </Link>
          </li>
        ))}

        <li className="flex justify-center">
          <Link
            href="/documents/new"
            aria-current={isActive("/documents/new") ? "page" : undefined}
            className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25"
          >
            <Upload className="size-6" strokeWidth={2} />
            <span className="sr-only">Upload document photo</span>
          </Link>
        </li>

        {TRAILING_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px] font-medium",
                isActive(item.href) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" strokeWidth={1.75} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
