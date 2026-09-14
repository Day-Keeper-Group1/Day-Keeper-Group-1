// KAN-57: Home, served from the database rather than fetched by the browser.

import { todayInZone } from "@/lib/contract/dates";
import { requireUser } from "@/server/auth/session";
import { getHome } from "@/server/documents";

import { HomeScreen } from "./home-screen";

/**
 * The first screen after signing in.
 *
 * The payload is read here rather than fetched from /api/home, because a server
 * component can call the same function the endpoint calls and save the browser
 * a round trip on the one screen that is opened most. The endpoint still exists
 * and is still the poll: HomeScreen asks it again every five seconds while
 * anything of hers is being read.
 *
 * `today` is resolved here too, in her zone, so every row on the screen decides
 * "is this overdue, is this this week" against one day rather than against
 * whatever the browser's clock says.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const payload = await getHome(user.id, user.timeZone);

  return (
    <HomeScreen
      initial={payload}
      user={user}
      today={todayInZone(user.timeZone)}
    />
  );
}
