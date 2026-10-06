import transcriptJson from "../../../../../data/synthetic-conversations/multiple-commitments/transcript.json";
import clear from "../../../../../data/synthetic-conversations/clear-commitment/transcript.json";
import missing from "../../../../../data/synthetic-conversations/missing-date/transcript.json";
import none from "../../../../../data/synthetic-conversations/no-commitment/transcript.json";
import cancelled from "../../../../../data/synthetic-conversations/cancelled-plan/transcript.json";
import unclear from "../../../../../data/synthetic-conversations/unclear-agreement/transcript.json";
import { parseConversationTranscript } from "@/lib/contract/voice";
import { MockCommitmentExtractionProvider } from "@/server/voice/mock-provider";
import { validateCommitmentOutcome } from "@/server/voice/provider";
import { ConversationScreen } from "./conversation-screen";

export default async function NewConversationPage() {
  const provider = new MockCommitmentExtractionProvider();
  const scenarios = await Promise.all(
    [
      { id: "multiple", label: "Several commitments", source: transcriptJson },
      { id: "clear", label: "One clear commitment", source: clear },
      { id: "missing", label: "A commitment without a date", source: missing },
      { id: "none", label: "No commitments", source: none },
      { id: "cancelled", label: "A cancelled plan", source: cancelled },
      { id: "unclear", label: "An unclear agreement", source: unclear },
    ].map(async ({ id, label, source }) => {
      const transcript = parseConversationTranscript(source);
      const outcome = await provider.extract(transcript);
      return {
        id,
        label,
        transcript,
        extraction: validateCommitmentOutcome(transcript, outcome).payload,
      };
    }),
  );
  return <ConversationScreen scenarios={scenarios} />;
}
