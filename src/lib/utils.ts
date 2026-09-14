import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The prototype's named text sizes, as tailwind-merge must know them.
 *
 * tailwind-merge sorts a `text-*` class into font size or colour by its name,
 * and a name it has never heard of (`text-label`) it files as a colour. Put
 * beside a real colour (`text-warn`) the size was then dropped as a duplicate,
 * so the caption rendered at the inherited size with nothing in the markup to
 * show why. The list is the one declared in src/app/globals.css.
 */
export const NAMED_TEXT_SIZES = [
  "title",
  "cta",
  "cam",
  "button",
  "row",
  "plan",
  "item",
  "sub",
  "day",
  "caption",
  "key",
  "label",
  "nav",
  "dow",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...NAMED_TEXT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
