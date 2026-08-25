import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import type { SessionUser } from "@/lib/contract/api";
import { UnauthenticatedError, requireUser } from "@/server/auth/session";

/**
 * The guard for everything inside (app).
 *
 * One check here covers dashboard, documents, tasks, calendar and settings, so
 * a page added later is protected by existing rather than by remembering. This
 * is ADR-002's "reached through exactly one function" applied to the pages as
 * well as to the endpoints.
 */
export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (error) {
    // redirect() signals by throwing, so it is called out here rather than
    // inside the try, where this same catch would swallow it.
    if (error instanceof UnauthenticatedError) redirect("/login");
    throw error;
  }

  return <AppShell user={user}>{children}</AppShell>;
}
