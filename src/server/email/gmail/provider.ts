import "server-only";
import { z } from "zod";
import { emailMessageSchema, type EmailMessage } from "@/lib/contract/email";
import type { EmailProvider } from "../provider";
import { gmailGet } from "./google";
import { sanitizeEmailHtml } from "../html";

type Part = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string };
  parts?: Part[];
};
const partSchema: z.ZodType<Part> = z.lazy(() =>
  z.object({
    mimeType: z.string().optional(),
    filename: z.string().optional(),
    body: z.object({ data: z.string().optional() }).optional(),
    parts: z.array(partSchema).max(100).optional(),
  }),
);

function bodyParts(part: Part, mimeType: string, depth = 0): string[] {
  if (depth > 15 || part.filename) return [];
  if (part.mimeType === mimeType && part.body?.data) {
    if (part.body.data.length > 200_000) return [];
    return [Buffer.from(part.body.data, "base64url").toString("utf8")];
  }
  // Ignore attached/forwarded message/rfc822 bodies.
  if (!part.mimeType?.startsWith("multipart/")) return [];
  return (part.parts ?? []).flatMap((child) =>
    bodyParts(child, mimeType, depth + 1),
  );
}

/** Unsupported/oversized messages are counted, never silently treated as no-action. */
export function parseGmailMessage(input: unknown): EmailMessage | null {
  const parsed = z
    .object({
      id: z.string(),
      internalDate: z.string().regex(/^\d+$/),
      payload: partSchema.and(
        z.object({
          headers: z.array(z.object({ name: z.string(), value: z.string() })),
        }),
      ),
    })
    .safeParse(input);
  if (!parsed.success) return null;
  const message = parsed.data;
  const header = (name: string) =>
    message.payload.headers.find((h) => h.name.toLowerCase() === name)?.value ??
    "";
  const sender = header("from");
  const date = new Date(Number(message.internalDate));
  if (!Number.isFinite(date.getTime())) return null;
  const html = bodyParts(message.payload, "text/html").join("\n");
  // Oversized HTML falls back to the independently bounded plain-text body.
  const cleanHtml = html.length <= 100_000 ? sanitizeEmailHtml(html) : "";
  const result = emailMessageSchema.safeParse({
    providerMessageId: message.id,
    from: sender.match(/<([^<>]+)>\s*$/)?.[1] ?? sender.trim(),
    subject: header("subject"),
    receivedAt: date.toISOString(),
    textBody: bodyParts(message.payload, "text/plain").join("\n\n").trim(),
    ...(cleanHtml && cleanHtml.length <= 100_000
      ? { sanitizedHtmlBody: cleanHtml }
      : {}),
  });
  return result.success ? result.data : null;
}

export class GmailProvider implements EmailProvider {
  readonly name = "gmail";
  skipped = 0;
  constructor(private readonly token: string) {}
  async readMessage(id: string): Promise<EmailMessage | null> {
    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) return null;
    return parseGmailMessage(
      await gmailGet(
        `messages/${encodeURIComponent(id)}?format=full`,
        this.token,
      ),
    );
  }
  async readPage(cursor: string | null) {
    const params = new URLSearchParams({
      maxResults: "20",
      labelIds: "INBOX",
      q: "newer_than:30d",
      includeSpamTrash: "false",
    });
    if (cursor) params.set("pageToken", cursor);
    const list = z
      .object({
        messages: z
          .array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]+$/) }))
          .max(20)
          .default([]),
        nextPageToken: z.string().optional(),
      })
      .parse(await gmailGet(`messages?${params}`, this.token));
    this.skipped = 0;
    const messages: EmailMessage[] = [];
    for (const item of list.messages) {
      const message = parseGmailMessage(
        await gmailGet(
          `messages/${encodeURIComponent(item.id)}?format=full`,
          this.token,
        ),
      );
      if (message) messages.push(message);
      else this.skipped++;
    }
    return { messages, nextCursor: list.nextPageToken ?? null };
  }
}
