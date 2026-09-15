// KAN-57: the calendar, served from the database in the person's own time zone.

import { monthParam } from "@/lib/confirm-flow";
import { todayInZone } from "@/lib/contract/dates";
import { requireUser } from "@/server/auth/session";
import { listTasks } from "@/server/tasks";

import { CalendarScreen } from "./calendar-screen";

/**
 * The month of dots, the day sheet and the task list.
 *
 * A thin server wrapper, the same shape as Home. The screen used to be a plain
 * client page that fetched /api/tasks and worked out "today" from
 * APP_TIME_ZONE, which is the deployment's fallback and not necessarily hers.
 * Every other real-data screen resolves the day from the session, and a
 * calendar that disagrees with Home about whether something is overdue is the
 * worst place in the product to have two answers. src/lib/contract/dates.ts
 * says it plainly: prefer the person's own zone whenever there is a session.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const user = await requireUser();
  const tasks = await listTasks(user.id, user.timeZone);

  return (
    <CalendarScreen
      initial={tasks}
      today={todayInZone(user.timeZone)}
      timeZone={user.timeZone}
      // KAN-59: `?month=2026-10` when the last letter checked lands her here,
      // so the task she just saved is on the month she sees
      // (src/lib/confirm-flow.ts).
      initialMonth={monthParam(month)}
    />
  );
}
