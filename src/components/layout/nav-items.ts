import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  ListChecks,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Upload", href: "/documents/new", icon: Upload },
  { label: "Archive", href: "/documents", icon: FolderOpen },
  { label: "Tasks", href: "/tasks", icon: ListChecks },
];

export const ADMIN_NAV: NavItem = {
  label: "Admin",
  href: "/admin",
  icon: ShieldCheck,
};

export const MOBILE_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Upload", href: "/documents/new", icon: Upload },
  { label: "Archive", href: "/documents", icon: FolderOpen },
  { label: "Tasks", href: "/tasks", icon: ListChecks },
];
