// KAN-57: one nav list, the prototype's three destinations, drawn by both bars.

import {
  CalendarDays,
  Camera,
  Eye,
  House,
  Mail,
  MessageSquareText,
  Settings,
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
 * their routes but no entry here: Settings hangs off the account menu (see
 * ACCOUNT_NAV), and the tasks page is a leftover of the earlier dashboard.
 */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: House },
  { label: "Photograph", href: "/documents/new", icon: Camera },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
];

/** Letters that arrive by email rather than through the camera. */
export const EMAIL_NAV: NavItem = {
  label: "Email",
  href: "/email",
  icon: Mail,
};

/** KAN-89: conversations, spoken rather than photographed or posted. */
export const VOICE_NAV: NavItem = {
  label: "Conversations",
  href: "/conversations/new",
  icon: MessageSquareText,
};

/**
 * Every destination both bars draw, in one order.
 *
 * The three in PRIMARY_NAV are the prototype's and are also the phone's bottom
 * bar; the two after them are reached from the sidebar on a wide screen and
 * from the phone's menu on a narrow one. They are listed here rather than in
 * each bar because the bars had drifted apart once already: Email was copied
 * into both by hand, and Conversations reached only one of them, so a phone
 * offered four destinations while a desktop offered six.
 */
export const MENU_NAV: NavItem[] = [...PRIMARY_NAV, EMAIL_NAV, VOICE_NAV];

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
 * KAN-147: what the account menu in the top bar offers above Sign out, at
 * every width.
 *
 * Settings is the way to Customisation and Accessibility. It used to be in the
 * desktop account menu only, so on a phone, whose bottom bar and navigation
 * menu do not list it, nothing led to any of the three. The account menu is
 * drawn at both widths, which makes it the one place that reaches Settings on
 * both without adding a sixth word to the navigation.
 */
export const ACCOUNT_NAV: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
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
