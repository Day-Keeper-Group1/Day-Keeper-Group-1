import Link from "next/link";
import type { HomePayload } from "@/lib/contract/api";

type VoiceRow = HomePayload["voiceToCheck"][number];

/** A Voice commitment in the shared Needs review area. */
export function VoiceInboxRow({ item }: { item: VoiceRow }) {
  return (
    <Link
      href={`/conversations/${item.conversationId}/commitments/${item.id}/review`}
      className="flex min-h-12 items-center gap-3 py-3"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-line bg-primary-soft text-caption font-bold">
        Voice
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-item">{item.title}</span>
        <span className="block text-label font-semibold text-warn">
          ready to check
        </span>
      </span>
      <span className="shrink-0 text-key font-bold text-primary">Review →</span>
    </Link>
  );
}
