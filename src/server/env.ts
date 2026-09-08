/**
 * Environment variables, checked once at startup.
 *
 * A missing variable should fail loudly on the first request with a sentence
 * that says which one and what to do, not produce a connection error five files
 * deep at three in the morning.
 *
 * This module is server-only. Nothing here may be imported from a client
 * component: it would put the database password in the browser bundle.
 */

import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(
      1,
      "DATABASE_URL is not set. Copy .env.example to .env.local, then run: docker compose up -d",
    )
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// connection string",
    ),

  /**
   * Where the photographs live: an S3-compatible endpoint. Locally that is the
   * MinIO in docker-compose.yml; deployed it is whatever bucket the host
   * provides. The protocol is the same either way, which is the whole point of
   * choosing one now rather than writing to the server's disk and rewriting it
   * later. See db/schema.sql.
   */
  STORAGE_ENDPOINT: z
    .string()
    .min(
      1,
      "STORAGE_ENDPOINT is not set. Copy .env.example to .env.local, then run: docker compose up -d",
    )
    .refine((v) => /^https?:\/\//.test(v), "STORAGE_ENDPOINT must be a URL"),

  /**
   * The address the BROWSER uses to reach the same storage.
   *
   * A signed URL is signed for one host, so the host the browser calls has to
   * be the host we signed. On a laptop both are localhost and this can be left
   * alone. They part company the moment the app itself runs in a container,
   * where the server says `http://storage:9000` and the browser must still say
   * `http://localhost:59000`; a signed URL made with the wrong one comes back
   * as an access error that looks like a permissions bug and is not.
   */
  STORAGE_PUBLIC_ENDPOINT: z.string().optional(),

  /** The bucket. One bucket holds everything; the key prefix separates people. */
  STORAGE_BUCKET: z.string().min(1).default("daykeeper"),

  STORAGE_ACCESS_KEY: z
    .string()
    .min(1, "STORAGE_ACCESS_KEY is not set. See .env.example."),
  STORAGE_SECRET_KEY: z
    .string()
    .min(1, "STORAGE_SECRET_KEY is not set. See .env.example."),

  /**
   * Which extraction provider to use.
   *
   * 'mock' is the default and needs no credentials, so the whole product runs
   * end to end before anyone has an API key. Swapping this is the single switch
   * that turns the real reader on.
   */
  AI_EXTRACTION_PROVIDER: z
    .enum(["mock", "azure", "openai", "bedrock"])
    .default("mock"),

  /**
   * The vision model, on RACE's Azure AI Foundry. Only read when
   * AI_EXTRACTION_PROVIDER is `azure`; the reader itself says which is missing
   * if either is, so a wrong value fails as a sentence and not a stack trace.
   * The key is RMIT's, issued for this project: never in a commit, a chat, or
   * this file's example.
   */
  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),

  /**
   * How long a signed-in session lasts. Long, because asking someone with a
   * failing memory to sign in repeatedly is a way of losing them.
   */
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new Error(
      `Environment is not configured.\n${lines.join("\n")}\n\nSee .env.example.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** True when running against the local Docker database rather than anything shared. */
export function isLocalDatabase(): boolean {
  return /localhost|127\.0\.0\.1/.test(env().DATABASE_URL);
}

/** The endpoint to sign browser-facing URLs with. See STORAGE_PUBLIC_ENDPOINT. */
export function publicStorageEndpoint(): string {
  return env().STORAGE_PUBLIC_ENDPOINT || env().STORAGE_ENDPOINT;
}
