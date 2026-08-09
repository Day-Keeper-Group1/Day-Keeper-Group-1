/**
 * Session tokens: making one, and hashing one for storage.
 *
 * The cookie carries the plaintext token; the database stores only its
 * SHA-256. A leaked table then contains nothing that opens a session. SHA-256
 * without salt is right here (and would be wrong for passwords): tokens are
 * 256 bits of randomness, so there is nothing to dictionary-attack.
 *
 * Deliberately not marked server-only, like password.ts: pure computation, and
 * the seed script needs it to plant the development session. Everything that
 * touches the database or the cookie lives in ./session.ts.
 */

import { createHash, randomBytes } from 'node:crypto';

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
