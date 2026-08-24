/**
 * KAN-29: turns RouteDefinition[] into an OpenAPI 3.1 document.
 *
 * Every shape here comes from z.toJSONSchema on the same zod schema that
 * validates the request or response, so the reference page and the runtime
 * check can never say two different things about one endpoint.
 */

import { z } from "zod";
import type { RouteDefinition } from "./handler";

const COOKIE_SECURITY_SCHEME = "cookieAuth";

export function buildOpenApiDocument(definitions: RouteDefinition[]) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const def of definitions) {
    const responses: Record<string, unknown> = {};
    for (const [status, response] of Object.entries(def.responses)) {
      responses[status] = {
        description: response.description,
        ...(response.schema
          ? {
              content: {
                "application/json": {
                  schema: z.toJSONSchema(response.schema, {
                    target: "draft-2020-12",
                  }),
                },
              },
            }
          : {}),
      };
    }

    const operation: Record<string, unknown> = {
      summary: def.summary,
      responses,
    };

    if (def.request) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: z.toJSONSchema(def.request.schema, {
              target: "draft-2020-12",
            }),
          },
        },
      };
    }

    if (def.auth) {
      operation.security = [{ [COOKIE_SECURITY_SCHEME]: [] }];
    }

    paths[def.path] ??= {};
    paths[def.path][def.method.toLowerCase()] = operation;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "DayKeeper API",
      version: "0.1.0",
      description:
        "Generated from the same schemas that validate every request, so this page cannot drift from the code.",
    },
    paths,
    components: {
      securitySchemes: {
        [COOKIE_SECURITY_SCHEME]: {
          type: "apiKey",
          in: "cookie",
          name: "dk_session",
        },
      },
    },
  };
}
