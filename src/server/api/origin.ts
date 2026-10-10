import { fail } from "./respond";

/** Require writes made from a page served by this application. */
export function rejectCrossOriginWrite(request: Request): Response | null {
  if (request.headers.get("origin") === new URL(request.url).origin) {
    return null;
  }
  return fail("forbidden", "Open this page in DayKeeper to save changes.");
}
