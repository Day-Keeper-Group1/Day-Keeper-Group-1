import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getVoiceCommitment } from "@/server/voice/records";
import { VoiceReviewForm } from "./voice-review-form";

type Props = {
  params: Promise<{ id: string; commitmentId: string }>;
};

export default async function VoiceReviewPage({ params }: Props) {
  const { id, commitmentId } = await params;
  const user = await requireUser();
  const commitment = await getVoiceCommitment(id, commitmentId, user.id);
  if (!commitment) notFound();
  if (commitment.status !== "needs-review") redirect("/dashboard");

  return <VoiceReviewForm conversationId={id} commitment={commitment} />;
}
