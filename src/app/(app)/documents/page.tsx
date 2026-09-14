// KAN-57: Your letters, served from the database rather than fetched by the browser.

import { requireUser } from "@/server/auth/session";
import { listDocuments } from "@/server/documents";

import { LettersScreen } from "./letters-screen";

/**
 * Every letter she has photographed, filed by month.
 *
 * Read here rather than fetched from /api/documents, the same way Home and the
 * calendar are: a server component can call the function the endpoint calls and
 * save the browser a round trip on a screen that is otherwise static. The
 * endpoint still exists and is still the poll, which LettersScreen runs only
 * while one of these letters is being read.
 */
export default async function LettersPage() {
  const user = await requireUser();
  const letters = await listDocuments(user.id, user.timeZone);

  return <LettersScreen initial={letters} />;
}
