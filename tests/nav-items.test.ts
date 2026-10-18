/**
 * KAN-147: what each width can reach from its menus.
 *
 * A phone draws the bottom bar and the navigation menu (MENU_NAV) and the
 * account menu (ACCOUNT_NAV); a desktop draws the sidebar (MENU_NAV and
 * DESKTOP_ONLY_NAV) and the same account menu. Settings had been reachable
 * from the desktop account menu only, so a phone had no way to it, or through
 * it to Customisation and Accessibility.
 */

import { describe, expect, it } from "vitest";

import {
  ACCOUNT_NAV,
  DESKTOP_ONLY_NAV,
  MENU_NAV,
} from "@/components/layout/nav-items";

const hrefs = (items: { href: string }[]) => items.map((item) => item.href);

describe("menu destinations", () => {
  it("the account menu offers Settings", () => {
    expect(hrefs(ACCOUNT_NAV)).toContain("/settings");
  });

  it("a phone reaches Settings from its menus", () => {
    const phone = [...hrefs(MENU_NAV), ...hrefs(ACCOUNT_NAV)];
    expect(phone).toContain("/settings");
  });

  it("no destination is listed twice across the menus", () => {
    const all = [
      ...hrefs(MENU_NAV),
      ...hrefs(DESKTOP_ONLY_NAV),
      ...hrefs(ACCOUNT_NAV),
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});
