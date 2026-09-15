// KAN-57: Your letters, served from the database rather than fetched by the browser.

import { requireUser } from "@/server/auth/session";
import { listDocuments } from "@/server/documents";

import { LettersScreen } from "./letters-screen";

/**
 * Every letter she has checked and saved, filed by month.
 *
 * Read here rather than fetched from /api/documents, the same way Home and the
 * calendar are: a server component can call the function the endpoint calls and
 * save the browser a round trip on a screen that is otherwise static.
 *
 * KAN-59: the letters she has saved, and only those, as in the prototype.
 * A letter still being read, one waiting to be checked and one whose reading
 * failed are all on Home under To check, where something can be done about
 * them; this is the filing cabinet, and nothing goes in it until she has said
 * it is right. That includes a letter that asked for nothing, which has no
 * task and so lives only here.
 */
export default async function LettersPage() {
  const user = await requireUser();
  const letters = await listDocuments(user.id, user.timeZone);

  return (
    <LettersScreen
      letters={letters.filter(
        (letter) =>
          letter.status === "confirmed" || letter.status === "archived",
      )}
    />
  );
}
