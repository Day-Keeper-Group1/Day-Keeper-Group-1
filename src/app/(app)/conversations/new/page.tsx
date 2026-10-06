import { voiceScenarios } from "@/server/voice/scenarios";
import { ConversationScreen } from "./conversation-screen";

export default function NewConversationPage() {
  return <ConversationScreen scenarios={voiceScenarios} />;
}
