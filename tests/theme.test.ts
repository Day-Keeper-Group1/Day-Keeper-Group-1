/**
 * The theme has to say the same thing in three places.
 *
 * The palette lives in `src/app/globals.css`. The user prototype repeats it
 * inline, because that file has to open as a standalone document with no
 * build step. `docs/theme.md` tabulates it so a person can read what each
 * value is for. Three copies is one more than anyone can keep in step by
 * hand, and a palette that has quietly drifted is invisible: the screen still
 * renders, it is just the wrong colour on one surface and nobody looks at
 * both at once.
 *
 * So the copies are compared here instead. globals.css is the source; the
 * other two have to agree with it.
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const GLOBALS = "src/app/globals.css";
const PROTOTYPE = "docs/prototype/user/daykeeper-sketch-live.html";
const DOC = "docs/theme.md";

/** `--name: #rrggbb;` inside the first :root block. A literal hex is a palette
 *  colour; everything mapped with var() is a name pointed at one. */
function paletteFrom(css: string): Map<string, string> {
  const rootBlock = css.slice(
    css.indexOf(":root"),
    css.indexOf("}", css.indexOf(":root")),
  );
  const found = new Map<string, string>();
  for (const m of rootBlock.matchAll(
    /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g,
  )) {
    found.set(m[1], m[2].toLowerCase());
  }
  return found;
}

/** The doc's table rows look like: | `--bg` | `#f4f0e4` | the page ... | */
function paletteFromDoc(md: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of md.matchAll(
    /\|\s*`--([a-z0-9-]+)`\s*\|\s*`(#[0-9a-fA-F]{6})`\s*\|/g,
  )) {
    found.set(m[1], m[2].toLowerCase());
  }
  return found;
}

const canonical = paletteFrom(read(GLOBALS));
const prototype = paletteFrom(read(PROTOTYPE));
const documented = paletteFromDoc(read(DOC));

describe("the palette", () => {
  it("is defined in globals.css, which is where it lives", () => {
    // Nineteen colours. If this number moves, the theme changed, and the two
    // copies below plus the contrast table in docs/theme.md all need looking at.
    expect(canonical.size).toBe(19);
    expect(canonical.get("primary")).toBe("#17452c");
  });

  it("has no blue in it", () => {
    // Rule 2 in docs/theme.md, made checkable: for every colour, blue is never
    // the dominant channel. An ageing eye needs roughly 2400ms longer to tell
    // blue from yellow, so this product does not spend blue on anything.
    for (const [name, hex] of canonical) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(b, `${name} (${hex}) leans blue`).toBeLessThanOrEqual(
        Math.max(r, g),
      );
    }
  });

  it("contains no pure white and no pure black", () => {
    // Rule 3: white grounds glare badly for cataracts and macular degeneration.
    for (const [name, hex] of canonical) {
      expect(hex, `${name} is pure white`).not.toBe("#ffffff");
      expect(hex, `${name} is pure black`).not.toBe("#000000");
    }
  });
});

describe("the copies of the palette", () => {
  it("the user prototype matches globals.css", () => {
    for (const [name, hex] of canonical) {
      expect(prototype.get(name), `--${name} in the prototype`).toBe(hex);
    }
  });

  it("docs/theme.md matches globals.css", () => {
    for (const [name, hex] of canonical) {
      expect(documented.get(name), `--${name} in docs/theme.md`).toBe(hex);
    }
  });

  it("no component reaches past the theme for a colour", () => {
    // Tailwind ships its own palette, and `bg-sky-500` is one keystroke away
    // from a status badge that is blue on a product where blue is the one
    // colour that cannot carry a status. Components use the theme's names
    // (bg-primary, text-warn, bg-danger-bg) so a colour cannot enter the
    // interface without going through docs/theme.md first.
    const sources = readdirSync(resolve(root, "src"), {
      recursive: true,
      encoding: "utf8",
    }).filter((f) => /\.(ts|tsx|css)$/.test(f));

    const offenders: string[] = [];
    for (const file of sources) {
      if (file.endsWith("globals.css")) continue; // where the palette is defined
      const text = read(resolve("src", file));
      const hits = text.match(
        /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
      );
      if (hits) offenders.push(`${file}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("the prototype names no colour outside its own token block", () => {
    // Every colour in that file has to come from the tokens, or changing the
    // theme means hunting through 700 lines of markup for stragglers.
    const html = read(PROTOTYPE);
    const afterTokens = html.slice(html.indexOf("}", html.indexOf(":root")));
    const strays = (afterTokens.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter(
      // The phone bezel and the desk it sits on are sketch scaffolding, not
      // product: they are deliberately outside the theme.
      (hex) => !/^#(2a2720|fcfcfb|5c5647)$/i.test(hex),
    );
    expect(strays).toEqual([]);
  });
});
