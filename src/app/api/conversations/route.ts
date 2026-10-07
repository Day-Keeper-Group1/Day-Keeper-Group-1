import { after } from "next/server";
import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import {
  extractSavedVoice,
  listVoiceConversations,
  MAX_TRANSCRIPT_JSON_BYTES,
  saveVoiceConversation,
  saveVoiceRequestSchema,
} from "@/server/voice/records";

/** Recent processing records let a returning user see the last outcome. */
export const GET = route(async () => {
  const user = await requireUser();
  return json(await listVoiceConversations(user.id));
});

/** Save a browser transcript and start one bounded extraction call. */
export const POST = route(async (request) => {
  const user = await requireUser();
  const bodyText = await request.text();
  if (Buffer.byteLength(bodyText, "utf8") > MAX_TRANSCRIPT_JSON_BYTES) {
    return fail("invalid_request", "This transcript is too long.");
  }
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return fail("invalid_request", "This transcript could not be read.");
  }
  const parsed = saveVoiceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", "This transcript could not be saved.");
  }

  const result = await saveVoiceConversation(user.id, parsed.data);
  if (result.created) {
    after(() => extractSavedVoice(result.id, user.id));
  }
  return json(
    { id: result.id, status: result.status },
    result.created ? 201 : 200,
  );
});
