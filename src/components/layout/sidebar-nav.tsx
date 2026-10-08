"use client";

// The desktop sidebar includes Email below the phone bar's three destinations.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivity } from "./activity";
import {
  DESKTOP_ONLY_NAV,
  isNavItemActive,
  PRIMARY_NAV,
  type NavItem,
} from "./nav-items";

const SIDEBAR_NAV: NavItem[] = [
  ...PRIMARY_NAV,
  { label: "Email", href: "/email", icon: Mail },
];

/**
 * One sidebar row.
 *
 * The selected row is told by weight and by a bar down its left edge, not by
 * colour: docs/theme.md rule five, and the reason a person with colour vision
 * deficiency can still see where she is. The row is min-h-12 because every
 * pressable thing in this product clears 48px.
 */
function SidebarLink({
  item,
  active,
  badge = 0,
}: {
  item: NavItem;
  active: boolean;
  /** KAN-59: letters waiting to be checked, beside Home. */
  badge?: number;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-12 items-center gap-3 rounded-lg py-2 pr-3 pl-4 text-base transition-colors",
        active
          ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground"
          : "font-medium text-sidebar-foreground hover:bg-sidebar-accent",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary"
        />
      ) : null}
      <item.icon className="size-6 shrink-0" strokeWidth={1.75} />
      {item.label}
      {badge > 0 ? (
        <span className="ml-auto rounded-full bg-primary px-2 py-px text-key font-bold text-primary-foreground">
          {badge}
          <span className="sr-only">
            {badge === 1 ? " letter to check" : " letters to check"}
          </span>
        </span>
      ) : null}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const { home } = useActivity();

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4">
      <Link
        href="/dashboard"
        className="mb-6 flex min-h-12 items-center gap-2 px-2"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground">
          D
        </span>
        <span className="text-base font-semibold text-sidebar-foreground">
          DayKeeper
        </span>
      </Link>

      <ul className="flex flex-1 flex-col gap-1">
        {SIDEBAR_NAV.map((item) => (
          <li key={item.href}>
            <SidebarLink
              item={item}
              active={isNavItemActive(pathname, item.href)}
              badge={
                item.href === "/dashboard" ? (home?.counts.needsReview ?? 0) : 0
              }
            />
          </li>
        ))}
      </ul>

      <ul className="mt-auto flex flex-col gap-1 pt-2">
        {DESKTOP_ONLY_NAV.map((item) => (
          <li key={item.href}>
            <SidebarLink
              item={item}
              active={isNavItemActive(pathname, item.href)}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
