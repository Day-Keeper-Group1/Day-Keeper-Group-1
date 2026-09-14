"use client";

// KAN-57: chrome only, the brand on phones and the account menu on both.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionUser } from "@/lib/contract/api";

/**
 * First and last initial, for the avatar.
 *
 * The stored display name is shown whole elsewhere on purpose: it holds
 * "Margaret Whitfield" while the greeting wants "Margaret", and a preferred
 * name is an open question rather than something to guess at by truncating.
 */
function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Topbar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Either way the safe place to be is the sign-in screen: if the request
      // failed, the next server render will send us here regardless.
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6">
      {/* The sidebar carries the brand on a wide screen, so it appears here
          only where there is no sidebar to carry it. */}
      <Link
        href="/dashboard"
        className="flex min-h-12 items-center gap-2 md:hidden"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground">
          D
        </span>
        <span className="text-base font-semibold text-foreground">
          DayKeeper
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Account menu for ${user.displayName}`}
              >
                <Avatar className="size-9">
                  <AvatarFallback className="text-sm font-semibold">
                    {initialsOf(user.displayName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-foreground">
                {user.displayName}
                <span className="block text-sm font-normal text-muted-foreground">
                  {user.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Settings is a desktop surface this release: a phone gets the
                three destinations and nothing else, so the entry is hidden
                rather than removed, and the route still works if typed. */}
            <DropdownMenuItem
              className="min-h-12 px-2 text-base max-md:hidden"
              render={
                <Link href="/settings">
                  <Settings className="size-5" strokeWidth={1.75} />
                  Settings
                </Link>
              }
            />
            <DropdownMenuSeparator className="max-md:hidden" />
            <DropdownMenuItem
              className="min-h-12 px-2 text-base"
              variant="destructive"
              disabled={signingOut}
              onClick={signOut}
            >
              <LogOut className="size-5" strokeWidth={1.75} />
              {signingOut ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
