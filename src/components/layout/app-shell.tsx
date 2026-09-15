// KAN-57: one column on a phone, the same sections with more room on desktop.

import type { SessionUser } from "@/lib/contract/api";

import { ActivityProvider } from "./activity";
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
    // KAN-59: one poll, one ready message and one saved note for every screen
    // inside, kept mounted while she moves between them (./activity.tsx).
    <ActivityProvider>
      <div className="flex min-h-dvh">
        <div className="hidden md:block">
          <SidebarNav />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} />
          {/* On a phone, the prototype's `.app` padding: 22px above, 18px at the
            sides, 96px below so the last row of a list clears the bottom bar
            and the camera button raised above it. */}
          <main className="flex-1 px-[18px] pt-[22px] pb-24 md:px-6 md:py-8 md:pb-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>

        <MobileBottomNav />
      </div>
    </ActivityProvider>
  );
}
