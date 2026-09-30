/**
 * Whether a database connection is encrypted, and how much to believe the
 * certificate at the other end.
 *
 * One definition for everything that opens a connection: the app's pool in
 * src/server/db.ts, and the scripts in db/ that build the schema, load the
 * seed and look for real accounts. They used to disagree. The app encrypted
 * every connection to a database that was not local; the scripts encrypted
 * none, so rebuilding the schema on Supabase on 25 September sent the
 * database password exchange, every account's email address (read by
 * db/real-accounts.ts) and the whole schema across the internet in the clear,
 * over a connection that anything in between could also have written to
 * (KAN-75).
 *
 * Deliberately free of imports, including `server-only`, for the reason
 * src/lib/local-host.ts gives: db/ runs outside Next.js, where that module
 * throws. Nothing here is a secret; it reads the certificate, which is
 * public, from the environment it runs in.
 */

import { hostIsLocal } from "./local-host";

export type DatabaseSsl = { ca?: string; rejectUnauthorized: boolean };

/**
 * The `ssl` option for a `pg` Client or Pool connecting to `url`: nothing for
 * a database on this machine, and a verified TLS connection for anything else.
 *
 * The Postgres in docker-compose.yml does not speak TLS at all, so asking for
 * it there fails to connect rather than quietly falling back.
 */
export function databaseSsl(url: string): DatabaseSsl | undefined {
  return hostIsLocal(url) ? undefined : remoteTls();
}

/**
 * How much to believe the certificate a hosted database presents.
 *
 * Encryption and identity are two things, and only the first comes free. A
 * managed Postgres is usually fronted by a connection pooler holding a
 * certificate signed by the provider's own authority, which is not in Node's
 * trust store, so verifying it fails with SELF_SIGNED_CERT_IN_CHAIN and the
 * connection cannot be made at all.
 *
 * The usual answer found in forum threads is rejectUnauthorized: false. That
 * keeps the traffic encrypted and stops checking who is on the other end,
 * which is the half of TLS that makes encryption worth having: anything that
 * can sit between here and the database may present its own certificate,
 * be believed, and read every password and row that goes past.
 *
 * So: hand the connection the provider's root certificate and verification
 * works properly. Supabase publishes it under Database, Configuration,
 * Settings, SSL configuration, Download certificate; paste its contents into
 * DATABASE_CA_CERT, newlines and all.
 *
 * Without it the connection still refuses to pretend. It verifies against
 * Node's own trust store, and if that fails the error names the missing
 * variable rather than leaving someone to search the message. Turning
 * verification off is deliberate, one variable, and says so on every start.
 */
function remoteTls(): DatabaseSsl {
  const ca = process.env.DATABASE_CA_CERT?.trim();
  if (ca) {
    // Say so here rather than letting TLS fail.
    //
    // A certificate arrives by being copied out of a dashboard and pasted into
    // a file, and the ways that goes wrong all produce a string that is present
    // but not a certificate: an editor that turns the quotes around it into
    // typographic ones, so the value stops at the first line and the rest of
    // the file is read as more of it; a path to the downloaded file instead of
    // its contents; a copy that caught the surrounding page. Every one of them
    // reaches TLS as a handshake failure, which surfaces as a 500 on sign-in
    // with nothing pointing at this variable.
    if (
      !/^-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----$/.test(ca)
    ) {
      throw new Error(
        "DATABASE_CA_CERT is set but is not a PEM certificate.\n\n" +
          "It must hold the certificate itself, not a path to it, beginning\n" +
          "-----BEGIN CERTIFICATE----- and ending -----END CERTIFICATE-----.\n" +
          'In .env.local wrap it in straight double quotes (") and keep the\n' +
          "line breaks. Typographic quotes (“ ”) are the usual cause: an\n" +
          "editor or input method substitutes them silently and the value is\n" +
          "then read as one line.",
      );
    }
    if (process.env.DATABASE_SSL_NO_VERIFY === "yes") {
      console.warn(
        "[db] DATABASE_CA_CERT and DATABASE_SSL_NO_VERIFY are both set.\n" +
          "     The certificate wins and verification stays on. Remove\n" +
          "     DATABASE_SSL_NO_VERIFY so the file says what is happening.",
      );
    }
    return { ca, rejectUnauthorized: true };
  }

  if (process.env.DATABASE_SSL_NO_VERIFY === "yes") {
    console.warn(
      "[db] DATABASE_SSL_NO_VERIFY=yes: the database connection is encrypted\n" +
        "     but unauthenticated. Anything between here and the database\n" +
        "     can present its own certificate and read what goes past. Set\n" +
        "     DATABASE_CA_CERT instead before this is deployed anywhere real.",
    );
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}
