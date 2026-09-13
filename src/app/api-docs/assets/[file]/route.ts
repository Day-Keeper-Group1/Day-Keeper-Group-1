import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fail } from "@/server/api/respond";

/**
 * GET /api-docs/assets/:file — the two files Swagger UI needs, from the
 * swagger-ui-dist package in node_modules.
 *
 * KAN-46. An allowlist rather than a directory listing: the parameter is a
 * file name chosen by whoever typed the URL, and the only two it may name are
 * written here.
 */
const FILES: Record<string, string> = {
  "swagger-ui.css": "text/css; charset=utf-8",
  "swagger-ui-bundle.js": "application/javascript; charset=utf-8",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return fail("not_found", "Not found.");
  }
  const { file } = await params;
  const type = FILES[file];
  if (!type) return fail("not_found", "Not found.");

  const body = await readFile(
    resolve(process.cwd(), "node_modules", "swagger-ui-dist", file),
  );
  return new Response(body, {
    headers: { "content-type": type, "cache-control": "no-store" },
  });
}
