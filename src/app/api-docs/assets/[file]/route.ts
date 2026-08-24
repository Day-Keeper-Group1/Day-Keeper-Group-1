/**
 * KAN-29: the two Swagger UI static files, served from swagger-ui-dist
 * instead of a CDN. `params` is a Promise in Next 16 (was sync pre-15), so it
 * must be awaited before the segment value is usable.
 *
 * Trap: under Turbopack, createRequire(import.meta.url) resolves against a
 * synthetic "[project]/..." path that does not exist on disk, so
 * require.resolve throws ENOENT at runtime. Anchoring to process.cwd()
 * instead resolves against the real project root.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { NextResponse } from "next/server";

const require = createRequire(path.join(process.cwd(), "package.json"));
const ASSET_ROOT = path.dirname(
  require.resolve("swagger-ui-dist/package.json"),
);

const ALLOWED_ASSETS: Record<string, string> = {
  "swagger-ui.css": "text/css",
  "swagger-ui-bundle.js": "text/javascript",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const contentType = ALLOWED_ASSETS[file];
  if (!contentType) {
    return new NextResponse(null, { status: 404 });
  }

  const body = await fs.promises.readFile(path.join(ASSET_ROOT, file));
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
  });
}
