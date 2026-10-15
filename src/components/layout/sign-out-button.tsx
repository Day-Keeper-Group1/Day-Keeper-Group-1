"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Sign out of this device, as the avatar menu in the top bar does.
 *
 * Either way the request goes, the next stop is the sign-in screen: if it
 * failed, the next server render sends the browser there regardless.
 */
export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button variant="outline" disabled={signingOut} onClick={signOut}>
      <LogOut className="size-5" strokeWidth={1.75} />
      {signingOut ? "Signing out..." : "Sign out"}
    </Button>
  );
}
