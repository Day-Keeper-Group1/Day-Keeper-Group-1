// KAN-29: Swagger UI served from our own assets, never a CDN, so the page
// works offline and does not depend on a third party staying up.
import { NextResponse } from "next/server";

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>DayKeeper API</title>
    <link rel="stylesheet" href="/api-docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api-docs/assets/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.SwaggerUIBundle({
          url: "/api/openapi.json",
          dom_id: "#swagger-ui",
        });
      };
    </script>
  </body>
</html>`;

export async function GET() {
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
