import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { gmailConfig } from "./config";

export const nonce = () => randomBytes(32).toString("base64url");
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

/** AAD prevents moving encrypted secrets between users or purposes. */
export function seal(value: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(gmailConfig().GMAIL_TOKEN_ENCRYPTION_KEY, "hex"),
    iv,
  );
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}
export function unseal(value: string, context: string) {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted secret");
  const [iv, tag, ciphertext] = parts.map((part) =>
    Buffer.from(part, "base64url"),
  );
  if (iv.length !== 12 || tag.length !== 16)
    throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(gmailConfig().GMAIL_TOKEN_ENCRYPTION_KEY, "hex"),
    iv,
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
