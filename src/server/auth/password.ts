/**
 * Password hashing.
 *
 * scrypt from Node's own crypto module: a memory-hard key derivation function
 * designed for exactly this, available without a dependency, and without a
 * native build step that would break on somebody's Windows laptop the first
 * time they run npm ci.
 *
 * The stored format is self-describing so the parameters can be raised later
 * without invalidating existing passwords:
 *
 *   scrypt$N$r$p$<salt-base64>$<hash-base64>
 */

// Deliberately not marked server-only: this module is pure computation with no
// database, no environment and no secrets of its own, and the seed script and
// the tests both need it.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Cost parameters. N=2^15 takes a few tens of milliseconds on a laptop, which
 * is imperceptible at sign-in and expensive in bulk for anyone with a stolen
 * copy of the table. maxmem has to be raised above Node's 32MB default because
 * these parameters legitimately need about 32MB.
 */
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, PARAMS);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Check a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed stored value: a corrupt row
 * should refuse the sign-in, not take the request down.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
      maxmem: PARAMS.maxmem,
    });

    // Length check first: timingSafeEqual throws on a mismatch rather than
    // returning false.
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * The minimum we ask of a password.
 *
 * Length only. Character-class rules push people towards Passw0rd! and towards
 * writing it on a note beside the computer, which for this audience is a worse
 * outcome than a long simple phrase.
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Please use at least 8 characters.';
  if (password.length > 200) return 'That password is too long.';
  return null;
}
