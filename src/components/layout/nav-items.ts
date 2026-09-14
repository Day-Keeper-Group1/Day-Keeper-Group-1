// KAN-57: one nav list, the prototype's three destinations, drawn by both bars.

import {
  CalendarDays,
  Camera,
  Eye,
  House,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/**
 * The prototype's bottom bar is the product's navigation, at every width.
 *
 * Three destinations and no more: a person who is being asked to photograph a
 * letter should not first have to choose between five words. Your letters is
 * reached from Home's "All your letters" line, and Tasks and Settings keep
 * their routes but no entry: Settings hangs off the desktop avatar menu, and
 * the tasks page is a leftover of the earlier dashboard.
 */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: House },
  { label: "Photograph", href: "/documents/new", icon: Camera },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
];

/**
 * Entries the sidebar shows and the phone bar does not.
 *
 * The accessibility panel is a settings surface rather than a destination, and
 * a phone bar with a fourth cell would crowd the raised camera button. On a
 * wide screen the sidebar has room at the bottom, where it costs nothing.
 */
export const DESKTOP_ONLY_NAV: NavItem[] = [
  { label: "Accessibility", href: "/accessibility", icon: Eye },
];

/**
 * Whether a nav entry is the screen being looked at.
 *
 * Both bars ask the same question, so they ask it in the same place: a phone
 * and a desktop disagreeing about which tab is lit is the kind of bug nobody
 * reports and everybody notices.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
