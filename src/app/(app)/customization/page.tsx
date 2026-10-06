import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  LayoutDashboard,
  ListFilter,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CustomizationPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <Button
        variant="outline"
        nativeButton={false}
        render={
          <Link href="/settings">
            <ArrowLeft className="size-5" strokeWidth={1.75} />
            Back to settings
          </Link>
        }
      />
      <PageHeader
        title="Customization"
        description="Set browser-saved preferences for your dashboard, calendar, tasks, and reminders."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sender rules</CardTitle>
          <CardDescription>
            Save default preferences for tasks from specific organizations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/customization/sender-rules">
                <Building2 className="size-5" strokeWidth={1.75} />
                Manage sender rules
              </Link>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminders</CardTitle>
          <CardDescription>
            Choose your preferred time, quiet hours, and days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/customization/reminders">
                <Bell className="size-5" strokeWidth={1.75} />
                Reminder preferences
              </Link>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dashboard sections</CardTitle>
          <CardDescription>
            Choose which sections appear on your dashboard and arrange their
            order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/customization/dashboard">
                <LayoutDashboard className="size-5" strokeWidth={1.75} />
                Manage dashboard sections
              </Link>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendar</CardTitle>
          <CardDescription>
            Choose the default calendar view and first day of the week.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/customization/calendar">
                <CalendarDays className="size-5" strokeWidth={1.75} />
                Manage Calendar Settings
              </Link>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task list</CardTitle>
          <CardDescription>
            Choose the default task view, sort order, and grouping.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/customization/task-list">
                <ListFilter className="size-5" strokeWidth={1.75} />
                Manage task list
              </Link>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
