import Link from "next/link";
import { Eye, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { requireUser } from "@/server/auth/session";

/**
 * The account page: who is signed in, and the ways into the preferences.
 *
 * Only what works is here. Changing a name, an email or a password, and
 * deleting an account, have no endpoint in this release (docs/api.md), so
 * they are not offered. The (app) layout has already checked the session;
 * requireUser() here only reads it.
 */
export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        description="Your account and your preferences."
      />

      <Link
        href="/email"
        className="inline-flex min-h-12 items-center font-semibold text-primary underline underline-offset-4"
      >
        Connect or manage Gmail
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>The account you are signed in to.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd>{user.displayName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accessibility</CardTitle>
          <CardDescription>
            Choose text size, colour vision, contrast, and motion preferences
            for this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/accessibility">
                <Eye className="size-5" strokeWidth={1.75} />
                Accessibility options
              </Link>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customization</CardTitle>
          <CardDescription>
            Personalize how DayKeeper works for you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/customization">
                <SlidersHorizontal className="size-5" strokeWidth={1.75} />
                Customization options
              </Link>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Sign out of DayKeeper on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
