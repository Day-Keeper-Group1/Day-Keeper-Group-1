import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getDocument } from "@/server/documents";
import { ReadingStatus } from "./reading-status";

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const document = await getDocument(id, user.id, user.timeZone);
  if (!document) notFound();
  if (document.status === "needs-review") redirect(`/documents/${id}/review`);
  if (document.status === "confirmed" || document.status === "archived")
    redirect(`/documents/${id}`);
  return <ReadingStatus document={document} />;
}
