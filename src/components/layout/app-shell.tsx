// KAN-57: one column on a phone, the same sections with more room on desktop.

import type { SessionUser } from "@/lib/contract/api";

import { MobileBottomNav } from "./mobile-bottom-nav";
import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden md:block">
        <SidebarNav />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        {/* pb-28 on a phone: the camera button is raised 26px above a bar that
            is itself about 80px tall, so anything less lets the last row of a
            list hide underneath it. */}
        <main className="flex-1 px-4 py-6 pb-28 md:px-6 md:py-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
