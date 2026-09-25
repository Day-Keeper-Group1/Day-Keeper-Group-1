// KAN-67: the Swagger page describes every route handler, and nothing that is not one.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { openApiDocument } from "@/server/api/openapi";

const API_DIR = join(__dirname, "..", "src", "app", "api");

/**
 * The description itself is served from here, and an entry for the page that
 * lists the entries would be noise on it.
 */
const NOT_DESCRIBED = new Set(["GET /api/openapi.json"]);

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** "GET /api/documents/{id}" for every method a route.ts under src/app/api exports. */
function handlers(): string[] {
  const found: string[] = [];
  for (const file of readdirSync(API_DIR, {
    recursive: true,
    encoding: "utf8",
  })) {
    if (!file.endsWith(`${sep}route.ts`) && file !== "route.ts") continue;
    const source = readFileSync(join(API_DIR, file), "utf8");
    const folder = relative(API_DIR, join(API_DIR, file, ".."));
    // A folder named [id] is the path parameter OpenAPI writes as {id}.
    const path = `/api/${folder.split(sep).join("/")}`.replace(
      /\[(\w+)\]/g,
      "{$1}",
    );
    for (const method of METHODS) {
      const exported = new RegExp(
        `export\\s+(async\\s+)?(function|const)\\s+${method}\\b`,
      );
      if (exported.test(source)) found.push(`${method} ${path}`);
    }
  }
  return found.filter((entry) => !NOT_DESCRIBED.has(entry)).sort();
}

function described(): string[] {
  return Object.entries(openApiDocument.paths)
    .flatMap(([path, operations]) =>
      Object.keys(operations).map(
        (method) => `${method.toUpperCase()} ${path}`,
      ),
    )
    .sort();
}

describe("the Swagger page", () => {
  it("finds the route handlers it is checking against", () => {
    expect(handlers()).toContain("POST /api/auth/login");
    expect(handlers()).toContain("DELETE /api/tasks/{id}/complete");
  });

  it("describes every route handler under src/app/api", () => {
    const missing = handlers().filter((entry) => !described().includes(entry));
    expect(missing, "add these to src/server/api/openapi.ts").toEqual([]);
  });

  it("describes nothing that is not a route handler", () => {
    const extra = described().filter((entry) => !handlers().includes(entry));
    expect(extra, "no route.ts exports these").toEqual([]);
  });

  it("puts every entry in a group the page lists", () => {
    const groups = openApiDocument.tags.map((tag) => tag.name);
    for (const operations of Object.values(openApiDocument.paths)) {
      for (const operation of Object.values(operations)) {
        expect(groups).toContain(operation.tags[0]);
      }
    }
  });
});
