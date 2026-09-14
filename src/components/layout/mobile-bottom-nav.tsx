"use client";

// KAN-57: the prototype's bottom bar, three cells with the camera raised.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavItemActive, PRIMARY_NAV } from "./nav-items";

const HOME = PRIMARY_NAV[0];
const PHOTOGRAPH = PRIMARY_NAV[1];
const CALENDAR = PRIMARY_NAV[2];

/**
 * Home and Calendar, either side of the camera.
 *
 * The selected tab is bold with a bar under the label rather than a different
 * colour (docs/theme.md rule five). The bar keeps its space when the tab is not
 * selected, so the two labels never shift by four pixels as a person moves
 * between them.
 */
function NavTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // The prototype's `.nav button`: 76px wide, 12px label, 3px between
        // icon, label and bar. The cell is at least 48px tall, so the small
        // label does not make a small target.
        "flex min-h-12 w-[76px] flex-col items-center justify-center gap-[3px] text-nav",
        active ? "font-bold text-foreground" : "text-ink-dim",
      )}
    >
      <Icon className="size-[21px]" strokeWidth={active ? 2.25 : 1.75} />
      {label}
      <span
        aria-hidden="true"
        className={cn(
          "h-1 w-7 rounded-[2px]",
          active ? "bg-primary" : "bg-transparent",
        )}
      />
    </Link>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      {/* `.nav`: padding 8px 10px 14px, the three cells spread around. */}
      <ul className="flex items-center justify-around px-2.5 pt-2 pb-3.5">
        <li className="flex justify-center">
          <NavTab
            href={HOME.href}
            label={HOME.label}
            icon={HOME.icon}
            active={isNavItemActive(pathname, HOME.href)}
          />
        </li>

        <li className="flex justify-center">
          {/* The one thing this product asks a person to do, so it is the one
              control that leaves the bar: 58px of primary green ringed in the
              page colour, the way the prototype draws it. The ring is the page
              rather than white because docs/theme.md has no white. */}
          <Link
            href={PHOTOGRAPH.href}
            aria-current={
              isNavItemActive(pathname, PHOTOGRAPH.href) ? "page" : undefined
            }
            className="-mt-[26px] flex size-[58px] items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-[0_6px_14px_rgba(23,69,44,0.35)]"
          >
            <Camera className="size-[25px]" strokeWidth={2} />
            <span className="sr-only">Photograph your letter</span>
          </Link>
        </li>

        <li className="flex justify-center">
          <NavTab
            href={CALENDAR.href}
            label={CALENDAR.label}
            icon={CALENDAR.icon}
            active={isNavItemActive(pathname, CALENDAR.href)}
          />
        </li>
      </ul>
    </nav>
  );
}
