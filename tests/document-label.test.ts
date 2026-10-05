// KAN-56: what a letter is called.
import { describe, expect, it } from "vitest";

import { documentLabel } from "@/server/documents";

const MELBOURNE = "Australia/Melbourne";

/** 9:12 on a Monday morning in Melbourne, which is the Sunday night in UTC. */
const UPLOADED_AT = "2026-08-09T23:12:44.000Z";

describe("what a letter is called", () => {
  it("names a letter after the reading once there is one", () => {
    expect(
      documentLabel({
        issuer: "AGL Energy",
        documentType: "Electricity bill",
        uploadedAt: UPLOADED_AT,
        pageCount: 2,
        timeZone: MELBOURNE,
      }),
    ).toBe("AGL Energy · Electricity bill");
  });

  it("falls back to the upload itself until both halves are known", () => {
    const provisional = "Photographed Mon 10 Aug at 9:12 am, 2 pages";

    expect(
      documentLabel({
        issuer: null,
        documentType: null,
        uploadedAt: UPLOADED_AT,
        pageCount: 2,
        timeZone: MELBOURNE,
      }),
    ).toBe(provisional);

    // Half a name is not a name. A reading that produced an issuer and no
    // document type would otherwise be called "AGL Energy undefined".
    expect(
      documentLabel({
        issuer: "AGL Energy",
        documentType: null,
        uploadedAt: UPLOADED_AT,
        pageCount: 2,
        timeZone: MELBOURNE,
      }),
    ).toBe(provisional);
  });

  it("counts one page in the singular", () => {
    expect(
      documentLabel({
        issuer: null,
        documentType: null,
        uploadedAt: UPLOADED_AT,
        pageCount: 1,
        timeZone: MELBOURNE,
      }),
    ).toBe("Photographed Mon 10 Aug at 9:12 am, 1 page");
  });

  it("tells the day in the person's zone and not the server's", () => {
    // The same instant, read from two places. Getting this wrong is the day off
    // by one that src/lib/contract/dates.ts exists to prevent, and here it
    // would put a letter on the wrong evening in the letters area.
    expect(
      documentLabel({
        issuer: null,
        documentType: null,
        uploadedAt: UPLOADED_AT,
        pageCount: 2,
        timeZone: "UTC",
      }),
    ).toBe("Photographed Sun 9 Aug at 11:12 pm, 2 pages");

    // Just after midnight in Melbourne, which is still the previous afternoon
    // in UTC, so the hour has to wrap onto the next day as well as the clock.
    expect(
      documentLabel({
        issuer: null,
        documentType: null,
        uploadedAt: "2026-08-10T14:05:00.000Z",
        pageCount: 1,
        timeZone: MELBOURNE,
      }),
    ).toBe("Photographed Tue 11 Aug at 12:05 am, 1 page");
  });
});
