// KAN-92: how many connections a pool holds, and whether they are encrypted, decided by where the database is.

/**
 * poolOptions() in src/server/db/client.ts answers two questions from the
 * connection string alone, and both are expensive to get wrong in a way no
 * laptop ever shows: a hosted database reached without TLS, or a host that
 * runs the app as many small copies each holding ten connections of a
 * database that allows a few dozen.
 *
 * No database here. The options are looked at; nothing connects.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { databaseSsl } from "@/lib/database-tls";
import { poolOptions } from "@/server/db/client";

const LOCAL = "postgres://daykeeper:secret@localhost:15432/daykeeper";
const HOSTED =
  "postgres://daykeeper:secret@aws-0-ap-southeast-2.pooler.example.com:6543/postgres";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the pool, for a database on this machine", () => {
  it("holds ten connections and does not ask for TLS", () => {
    const options = poolOptions(LOCAL);

    expect(options.max).toBe(10);
    // The Postgres in docker-compose.yml does not speak TLS at all.
    expect(options.ssl).toBeUndefined();
    expect(options.connectionString).toBe(LOCAL);
  });
});

describe("the pool, for a database anywhere else", () => {
  it("holds one connection, encrypted and verified", () => {
    // Whatever this machine's .env.local says about certificates, the two
    // sides of the comparison below read the same environment.
    vi.stubEnv("DATABASE_CA_CERT", "");
    vi.stubEnv("DATABASE_SSL_NO_VERIFY", "");

    const options = poolOptions(HOSTED);

    expect(options.max).toBe(1);
    expect(options.ssl).toEqual(databaseSsl(HOSTED));
    expect(options.ssl).toEqual({ rejectUnauthorized: true });
    expect(options.connectionString).toBe(HOSTED);
  });
});

describe("the pool, wherever the database is", () => {
  it.each([LOCAL, HOSTED])(
    "gives up on a connection after ten seconds, and on an idle one after thirty: %s",
    (url) => {
      expect(poolOptions(url)).toMatchObject({
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
      });
    },
  );
});
