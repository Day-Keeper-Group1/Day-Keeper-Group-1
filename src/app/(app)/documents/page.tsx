import { requireUser } from "@/server/auth/session";
import { listDocuments } from "@/server/documents";
import { LettersScreen } from "./letters-screen";

export const metadata = { title: "Your letters | DayKeeper" };

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
