// KAN-92: the people and letters a database test starts from.

/**
 * Fixtures.
 *
 * Every test begins with empty tables (./setup.ts) and builds what it needs
 * here. Wherever the app has a function that makes the thing, the fixture
 * calls that function, so a fixture cannot describe a row the app would never
 * write. A row is written directly, through the witness, only for what no code
 * writes: a person who never went through the register route, a session that
 * has expired.
 *
 * This file holds what the tests beside it need so far, and grows with them.
 *
 * No tests in here.
 */

import {
  parseExtractionResult,
  type ExtractionResult,
} from "@/lib/contract/extraction";
import { hashPassword } from "@/server/auth/password";
import { rows } from "./witness";

/** Every person made here signs in with this. */
export const PASSWORD = "correct horse battery";

export type Person = {
  id: string;
  email: string;
  displayName: string;
  timeZone: string;
};

/**
 * A person with an account: "Margaret" becomes margaret@example.com.
 *
 * Written directly, with a real password hash, so she can also sign in through
 * the login route. The database gives her the role and the time zone every new
 * account gets.
 */
export async function aPerson(name: string): Promise<Person> {
  const [person] = await rows<Person>(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name AS "displayName", timezone AS "timeZone"`,
    [`${name.toLowerCase()}@example.com`, name, await hashPassword(PASSWORD)],
  );
  return person;
}

/** One field of a reading: a confident value, or the value and how sure the reader was. */
type FieldAnswer =
  | string
  | { value: string | null; status: "confirmed" | "uncertain" | "unreadable" };

/**
 * What a reader answered, held to the contract the way a real answer is.
 *
 * `fields` is keyed by field: a plain string is a value the reader was sure
 * of. The six the contract requires must all be there, and
 * parseExtractionResult() throws when one is not, so a fixture cannot be a
 * reading the app would have refused.
 */
export function aReading(
  fields: Record<string, FieldAnswer>,
  identifiers: Array<{
    label: string;
    value: string;
    status?: "confirmed" | "uncertain";
  }> = [],
): ExtractionResult {
  return parseExtractionResult({
    fields: Object.entries(fields).map(([key, answer]) =>
      typeof answer === "string"
        ? { key, value: answer, status: "confirmed" }
        : { key, ...answer },
    ),
    identifiers: identifiers.map((identifier) => ({
      status: "confirmed",
      ...identifier,
    })),
  });
}
