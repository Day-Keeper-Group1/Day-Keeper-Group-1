import "server-only";
import { z } from "zod";
import { gmailGet } from "./google";
import { parseGmailMessage } from "./provider";

const MAX_IMAGE = 1_000_000;
const partSchema = z.object({
  mimeType: z.string().optional(),
  headers: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .optional(),
  body: z
    .object({
      size: z.number().optional(),
      data: z.string().optional(),
      attachmentId: z.string().optional(),
    })
    .optional(),
  parts: z.array(z.unknown()).optional(),
});

function rasterType(bytes: Buffer): string | null {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii")))
    return "image/gif";
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  return null;
}

export async function readEmbeddedImages(messageId: string, token: string) {
  const raw = await gmailGet(
    `messages/${encodeURIComponent(messageId)}?format=full`,
    token,
  );
  const message = parseGmailMessage(raw);
  const references = new Set(
    Array.from(
      (message?.sanitizedHtmlBody ?? "").matchAll(/data-email-cid="([^"]+)"/g),
      (match) => match[1],
    ),
  );
  const root = z.object({ payload: z.unknown() }).parse(raw);
  const candidates: { cid: string; part: z.infer<typeof partSchema> }[] = [];
  let visited = 0;
  function visit(input: unknown, depth = 0) {
    if (depth > 15 || ++visited > 200) return;
    const parsed = partSchema.safeParse(input);
    if (!parsed.success) return;
    const part = parsed.data;
    const contentId = part.headers
      ?.find((header) => header.name.toLowerCase() === "content-id")
      ?.value.trim()
      .replace(/^<|>$/g, "");
    if (contentId && references.has(encodeURIComponent(contentId))) {
      candidates.push({ cid: encodeURIComponent(contentId), part });
    }
    if (part.mimeType?.startsWith("multipart/"))
      for (const child of part.parts ?? []) visit(child, depth + 1);
  }
  visit(root.payload);
  const images: Record<string, string> = Object.create(null);
  let total = 0;
  // A bounded parallel batch avoids a slow request per image in a long newsletter.
  const results = await Promise.all(
    candidates.slice(0, 8).map(async ({ cid, part }) => {
      if (
        !/^image\/(png|jpeg|gif|webp)$/.test(part.mimeType ?? "") ||
        (part.body?.size ?? 0) > MAX_IMAGE
      )
        return null;
      let data = part.body?.data;
      try {
        if (!data && part.body?.attachmentId) {
          const attachment = await gmailGet(
            `messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(part.body.attachmentId)}`,
            token,
          );
          data = z
            .object({ data: z.string().max(1_400_000) })
            .parse(attachment).data;
        }
        if (
          !data ||
          data.length > 1_400_000 ||
          !/^[A-Za-z0-9_\-=]+$/.test(data)
        )
          return null;
        const bytes = Buffer.from(data, "base64url");
        const mime = rasterType(bytes);
        if (!mime || mime !== part.mimeType || bytes.length > MAX_IMAGE)
          return null;
        return { cid, bytes, mime };
      } catch {
        return null;
      }
    }),
  );
  for (const result of results) {
    if (!result || total + result.bytes.length > 4_000_000) continue;
    total += result.bytes.length;
    images[result.cid] =
      `data:${result.mime};base64,${result.bytes.toString("base64")}`;
  }
  return {
    images,
    skipped: Math.max(0, references.size - Object.keys(images).length),
  };
}
