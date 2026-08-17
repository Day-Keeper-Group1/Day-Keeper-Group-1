/**
 * The drawing has to agree with the definition.
 *
 * `docs/schema-map.html` is fourteen boxes placed by hand, which makes it the
 * artefact in this repository most likely to quietly stop being true: a table
 * gets added to `db/schema.sql`, the picture keeps rendering perfectly, and the
 * next person to read it is confidently misled. A picture that is wrong is
 * worse than no picture, because it is trusted.
 *
 * This does not check the columns. It checks that every table exists in both
 * places and that the drawing's own headline count is right, which is what
 * catches the failure that actually happens.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const schema = read("db/schema.sql");
const map = read("docs/schema-map.html");

const tables = [...schema.matchAll(/CREATE TABLE (\w+)/g)]
  .map((m) => m[1])
  .sort();

/** The table name in a box's heading, before any step badges. */
const drawn = [...map.matchAll(/<h2>(\w+)</g)].map((m) => m[1]).sort();

const NUMBERS: Record<number, string> = {
  10: "Ten",
  11: "Eleven",
  12: "Twelve",
  13: "Thirteen",
  14: "Fourteen",
  15: "Fifteen",
  16: "Sixteen",
};

describe("the schema map", () => {
  it("draws every table the schema defines, and no others", () => {
    expect(tables.length).toBeGreaterThan(0);
    expect(drawn).toEqual(tables);
  });

  it("says how many tables there are, and is right", () => {
    // The sentence a reader takes on trust without counting.
    const written = NUMBERS[tables.length];
    expect(written, `no word for ${tables.length}`).toBeDefined();
    expect(map).toContain(`${written} tables.`);
  });
});
