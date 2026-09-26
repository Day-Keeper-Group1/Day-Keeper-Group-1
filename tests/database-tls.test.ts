// KAN-75: every connection to a database that is not local is encrypted and verified, scripts included.
import { afterEach, describe, expect, it, vi } from "vitest";

import { databaseSsl } from "@/lib/database-tls";

const LOCAL = "postgres://daykeeper:daykeeper@localhost:15432/daykeeper";
const HOSTED =
  "postgresql://postgres.ref:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";
const PEM =
  "-----BEGIN CERTIFICATE-----\nMIIDxTCCAq2gAwIBAgIBADANBgkqhkiG9w0B\n-----END CERTIFICATE-----";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the ssl option for a database connection", () => {
  it("asks for nothing on this machine, whose Postgres does not speak TLS", () => {
    vi.stubEnv("DATABASE_CA_CERT", PEM);
    expect(databaseSsl(LOCAL)).toBeUndefined();
  });

  it("verifies a hosted database against the certificate it was given", () => {
    vi.stubEnv("DATABASE_CA_CERT", `  ${PEM}\n`);
    expect(databaseSsl(HOSTED)).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("still verifies, against Node's own list, when no certificate was given", () => {
    vi.stubEnv("DATABASE_CA_CERT", "");
    vi.stubEnv("DATABASE_SSL_NO_VERIFY", "");
    expect(databaseSsl(HOSTED)).toEqual({ rejectUnauthorized: true });
  });

  it("says so, rather than failing a handshake, when the certificate is not one", () => {
    vi.stubEnv("DATABASE_CA_CERT", "“-----BEGIN CERTIFICATE-----");
    expect(() => databaseSsl(HOSTED)).toThrow(/not a PEM certificate/);
  });

  it("stops checking identity only when told to in so many words, and says so", () => {
    vi.stubEnv("DATABASE_CA_CERT", "");
    vi.stubEnv("DATABASE_SSL_NO_VERIFY", "yes");
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(databaseSsl(HOSTED)).toEqual({ rejectUnauthorized: false });
    expect(warned).toHaveBeenCalled();
  });
});
