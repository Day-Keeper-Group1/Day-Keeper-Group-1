import { fail } from "@/server/api/respond";

/**
 * GET /api-docs — Swagger UI for every endpoint in docs/api.md.
 *
 * KAN-46, widened to the whole API by KAN-67. One page of HTML that loads
 * Swagger UI from ./assets, which serves the files from the swagger-ui-dist
 * package rather than a CDN, so the page
 * works with no internet and never runs a script from a host we do not
 * control. It reads /api/openapi.json.
 */
export function GET() {
  if (process.env.NODE_ENV === "production") {
    return fail("not_found", "Not found.");
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DayKeeper API</title>
  <link rel="stylesheet" href="/api-docs/assets/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api-docs/assets/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/api/openapi.json",
      dom_id: "#swagger-ui",
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
