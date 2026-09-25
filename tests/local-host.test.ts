/**
 * Whether a URL points at this machine.
 *
 * Small and worth testing carefully, because it is now the one thing standing
 * between `npm run db:reset` and a database serving a public address. Every
 * case below was a real difference between the five copies this replaced, or a
 * string that one of them got wrong.
 */

import { describe, expect, it } from "vitest";

import { hostIsLocal } from "@/lib/local-host";

const REMOTE =
  "postgresql://postgres.abcdefgh:s3cret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";

describe("hosts on this machine", () => {
  it.each([
    "postgres://daykeeper:pw@localhost:15432/daykeeper",
    "postgres://daykeeper:pw@127.0.0.1:15432/daykeeper",
    "postgres://daykeeper:pw@[::1]:15432/daykeeper",
    // A container reaching back out to the laptop.
    "postgres://daykeeper:pw@host.docker.internal:5432/daykeeper",
    // The service names in docker-compose.yml, used when the app runs beside
    // them rather than on the laptop.
    "postgres://daykeeper:pw@db:5432/daykeeper",
    "http://storage:9000",
    "http://localhost:19020",
  ])("%s", (url) => {
    expect(hostIsLocal(url)).toBe(true);
  });
});

describe("hosts that are not", () => {
  it.each([
    REMOTE,
    "https://abcdefgh.storage.supabase.co/storage/v1/s3",
    "postgres://user:pw@db.internal.example.com:5432/app",
  ])("%s", (url) => {
    expect(hostIsLocal(url)).toBe(false);
  });
});

describe("the strings the old copies got wrong", () => {
  // The loosest of them was /localhost|127\.0\.0\.1/ against the whole
  // connection string, with no anchor. A password is part of that string.
  it("does not call a hosted database local because of its password", () => {
    const url =
      "postgresql://postgres.abcdefgh:localhost127.0.0.1@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";
    expect(hostIsLocal(url)).toBe(false);
  });

  it("does not call a hosted database local because of its name", () => {
    expect(
      hostIsLocal("postgres://u:p@my-localhost-db.example.com:5432/app"),
    ).toBe(false);
  });

  it("does not match a database whose name contains a local host", () => {
    expect(hostIsLocal("postgres://u:p@example.com:5432/localhost")).toBe(
      false,
    );
  });

  // Matching the host by name and not by substring cuts both ways.
  it("is not fooled by a subdomain of a local-looking host", () => {
    expect(hostIsLocal("https://localhost.attacker.example/x")).toBe(false);
  });
});

describe("when it cannot tell", () => {
  // The question is only ever asked to decide whether something destructive
  // may proceed, so "I cannot tell" has to mean no.
  it.each(["", "not a url", "localhost", "postgres://"])(
    "refuses to say local: %s",
    (url) => {
      expect(hostIsLocal(url)).toBe(false);
    },
  );
});

describe("case", () => {
  it("does not care", () => {
    expect(hostIsLocal("postgres://u:p@LOCALHOST:5432/app")).toBe(true);
  });
});
