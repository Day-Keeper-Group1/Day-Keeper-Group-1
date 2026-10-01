// KAN-92: the school key's daily ceiling, counted and spent against a real PostgreSQL.

/**
 * The school key's budget.
 *
 * src/server/ai/school-key.ts keeps the school's key under a daily ceiling:
 * every use is one audit_logs row, and the uses since midnight in Melbourne
 * are counted before the next one is allowed. Here its two functions run
 * against a real database, and what they left in audit_logs is read through
 * the witness. The statements behind them are in
 * src/server/db/queries/audit.ts.
 *
 * Two things are stand-ins. The environment, which is the real one with
 * AI_DAILY_CALL_LIMIT set by each test, because env() reads the variable once
 * and keeps it. And `countAuditActionsSinceStartOfToday`, which is the real
 * function with a record kept of its calls, because that is the only way to
 * see that no question is asked of the database when there is no ceiling.
 *
 * The database's clock cannot be faked, and where today begins is the
 * database's decision. So a use that fell yesterday is a row these tests write
 * directly, placed around the midnight PostgreSQL itself computes. That makes
 * these tests of the real today only: what happens on the day the clocks
 * change is seen by running them on that day.
 */

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Today's ceiling, as the deployed site would set it. Undefined is a laptop: no ceiling. */
const ceiling = vi.hoisted(() => ({ limit: undefined as number | undefined }));

vi.mock("@/server/env", async (importActual) => {
  const actual = await importActual<typeof import("@/server/env")>();
  return {
    ...actual,
    env: () => ({ ...actual.env(), AI_DAILY_CALL_LIMIT: ceiling.limit }),
  };
});
vi.mock("@/server/db/queries/audit", async (importActual) => {
  const actual =
    await importActual<typeof import("@/server/db/queries/audit")>();
  return {
    ...actual,
    countAuditActionsSinceStartOfToday: vi.fn(
      actual.countAuditActionsSinceStartOfToday,
    ),
  };
});

import { addDays, todayInZone } from "@/lib/contract/dates";
import {
  SCHOOL_KEY_ACTION,
  SchoolKeyExhausted,
  schoolKeyBudget,
  spendSchoolKey,
} from "@/server/ai/school-key";
import { countAuditActionsSinceStartOfToday } from "@/server/db/queries/audit";

import { rows } from "./support/witness";

const MELBOURNE = "Australia/Melbourne";

/**
 * The instant today began in Melbourne, in the words of the statement the
 * query builder replaced. $1 is the zone.
 */
const MIDNIGHT = "(date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1)";

/**
 * One audit line written directly, so far from Melbourne's midnight: "-1
 * minute" was yesterday, "1 minute" is today.
 */
async function aLine(action: string, fromMidnight: string): Promise<void> {
  await rows(
    `INSERT INTO audit_logs (action, created_at)
     VALUES ($2, ${MIDNIGHT} + $3::interval)`,
    [MELBOURNE, action, fromMidnight],
  );
}

/** Every line in the log, oldest first, with what kind of JSON its detail is. */
function lines() {
  return rows(
    `SELECT actor_id, action, target_type, target_id, detail,
            jsonb_typeof(detail) AS kind,
            created_at > now() - interval '1 minute' AS "justNow"
       FROM audit_logs
      ORDER BY created_at, id`,
  );
}

describe("the school key's budget", () => {
  beforeEach(() => {
    ceiling.limit = undefined;
    vi.mocked(countAuditActionsSinceStartOfToday).mockClear();
  });

  describe("with no ceiling set", () => {
    it("answers that nothing is used, and asks the database nothing", async () => {
      await aLine(SCHOOL_KEY_ACTION, "1 minute");
      await aLine(SCHOOL_KEY_ACTION, "2 minutes");

      expect(await schoolKeyBudget()).toStrictEqual({
        limit: null,
        used: 0,
        exhausted: false,
      });
      expect(countAuditActionsSinceStartOfToday).not.toHaveBeenCalled();
    });

    it("still writes each use down, and still asks nothing first", async () => {
      await spendSchoolKey("letters");
      await spendSchoolKey("letters");

      expect(await lines()).toHaveLength(2);
      expect(countAuditActionsSinceStartOfToday).not.toHaveBeenCalled();
    });
  });

  describe("counting today's uses", () => {
    it("counts the uses of the key since midnight in Melbourne, and no other line", async () => {
      ceiling.limit = 200;
      await aLine(SCHOOL_KEY_ACTION, "-1 minute");
      await aLine(SCHOOL_KEY_ACTION, "0 minutes");
      await aLine(SCHOOL_KEY_ACTION, "1 minute");
      // Lines about something else, on both sides of midnight.
      await aLine("user.register", "-1 minute");
      await aLine("user.register", "1 minute");

      // The use at midnight itself belongs to today. `used` is a number, not
      // the text PostgreSQL sends a count as: "2" would not be equal here.
      expect(await schoolKeyBudget()).toStrictEqual({
        limit: 200,
        used: 2,
        exhausted: false,
      });
      expect(countAuditActionsSinceStartOfToday).toHaveBeenCalledTimes(1);
    });

    // The rows above are placed around an instant PostgreSQL computed. This
    // holds that instant to a calendar, so that the test above is about
    // midnight in Melbourne and not about two copies of one expression
    // agreeing with each other.
    it("measures from the midnight a calendar in Melbourne names", async () => {
      const [{ midnight, now }] = await rows<{ midnight: Date; now: Date }>(
        `SELECT ${MIDNIGHT} AS midnight, now() AS now`,
        [MELBOURNE],
      );

      const today = todayInZone(MELBOURNE, now);
      expect(todayInZone(MELBOURNE, midnight)).toBe(today);
      expect(todayInZone(MELBOURNE, new Date(midnight.getTime() - 1))).toBe(
        addDays(today, -1),
      );
    });

    it("counts nothing when the key has not been used today", async () => {
      ceiling.limit = 200;
      await aLine(SCHOOL_KEY_ACTION, "-1 minute");

      expect(await schoolKeyBudget()).toStrictEqual({
        limit: 200,
        used: 0,
        exhausted: false,
      });
    });
  });

  describe("reaching the ceiling", () => {
    it("is exhausted once today's uses reach the ceiling, and stays so beyond it", async () => {
      ceiling.limit = 2;
      // Yesterday's uses are no part of today's ceiling.
      await aLine(SCHOOL_KEY_ACTION, "-1 minute");
      await aLine(SCHOOL_KEY_ACTION, "-2 minutes");

      await aLine(SCHOOL_KEY_ACTION, "1 minute");
      expect(await schoolKeyBudget()).toStrictEqual({
        limit: 2,
        used: 1,
        exhausted: false,
      });

      await aLine(SCHOOL_KEY_ACTION, "2 minutes");
      expect(await schoolKeyBudget()).toStrictEqual({
        limit: 2,
        used: 2,
        exhausted: true,
      });

      await aLine(SCHOOL_KEY_ACTION, "3 minutes");
      expect(await schoolKeyBudget()).toStrictEqual({
        limit: 2,
        used: 3,
        exhausted: true,
      });
    });
  });

  describe("spending", () => {
    it("writes one line that says who spent and on what, its detail an object", async () => {
      ceiling.limit = 200;
      const letter = randomUUID();

      await spendSchoolKey("letters", { type: "document", id: letter });

      // The key is the site's, so the line has no actor. `detail` reads back
      // as an object and is one in the table: stored as its JSON text it
      // would be a jsonb string.
      expect(await lines()).toEqual([
        {
          actor_id: null,
          action: "ai.call",
          target_type: "document",
          target_id: letter,
          detail: { module: "letters" },
          kind: "object",
          justNow: true,
        },
      ]);
    });

    it("leaves the target empty for a call that was about no row", async () => {
      ceiling.limit = 200;

      await spendSchoolKey("voice");

      expect(await lines()).toEqual([
        {
          actor_id: null,
          action: "ai.call",
          target_type: null,
          target_id: null,
          detail: { module: "voice" },
          kind: "object",
          justNow: true,
        },
      ]);
    });

    it("is counted by the next check, and at the ceiling refuses and writes nothing", async () => {
      ceiling.limit = 2;

      await spendSchoolKey("letters");
      await spendSchoolKey("voice");
      expect(await schoolKeyBudget()).toStrictEqual({
        limit: 2,
        used: 2,
        exhausted: true,
      });

      const refused = spendSchoolKey("letters", {
        type: "document",
        id: randomUUID(),
      });
      await expect(refused).rejects.toBeInstanceOf(SchoolKeyExhausted);
      await expect(refused).rejects.toThrow(
        "the school key's daily limit of 2 calls has been reached",
      );

      const written = await lines();
      expect(written.map((line) => line.detail)).toEqual([
        { module: "letters" },
        { module: "voice" },
      ]);
    });
  });
});
