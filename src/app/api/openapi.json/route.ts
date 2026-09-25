import { fail } from "@/server/api/respond";
import { openApiDocument } from "@/server/api/openapi";

/**
 * GET /api/openapi.json — the OpenAPI description behind /api-docs.
 *
 * KAN-46 described the development reader only. KAN-67: it now describes
 * every product endpoint, from src/server/api/openapi.ts, which says what an
 * entry holds and which test keeps it complete. docs/api.md stays the
 * specification.
 */
export function GET() {
  if (process.env.NODE_ENV === "production") {
    return fail("not_found", "Not found.");
  }

  return Response.json(openApiDocument);
}
