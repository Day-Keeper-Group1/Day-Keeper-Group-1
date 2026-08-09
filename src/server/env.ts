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
   * Which extraction provider to use.
   *
   * 'mock' is the default and needs no credentials, so the whole product runs
   * end to end before anyone has an API key. Swapping this is the single switch
   * that turns the real reader on.
   */
  AI_EXTRACTION_PROVIDER: z.enum(["mock", "openai", "bedrock"]).default("mock"),

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
