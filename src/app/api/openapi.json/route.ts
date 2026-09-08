import { CONTRACT_FIELD_KEYS } from "@/lib/contract/fields";
import { fail } from "@/server/api/respond";

/**
 * GET /api/openapi.json — the OpenAPI description behind /api-docs.
 *
 * KAN-46: it describes the development endpoint only. The product API in
 * docs/api.md is written for people and is the specification; this file
 * exists so a browser can try the reader, not to replace that document.
 * Hand-written, because there is one endpoint and a generator would be more
 * code than the thing it generates.
 */
export function GET() {
  if (process.env.NODE_ENV === "production") {
    return fail("not_found", "Not found.");
  }

  const fieldProperties = Object.fromEntries(
    CONTRACT_FIELD_KEYS.map((key) => [key, { type: "string", nullable: true }]),
  );

  return Response.json({
    openapi: "3.0.3",
    info: {
      title: "DayKeeper reader (development)",
      version: "0.1.0",
      description:
        "A photo of a letter in, the six contract fields out. Nothing is stored. Not available in production. The product API is specified in docs/api.md.",
    },
    paths: {
      "/api/dev/extract": {
        post: {
          summary: "Read a letter",
          description:
            "Send one or more photographed pages of ONE letter, in reading order. The reader named by AI_EXTRACTION_PROVIDER answers with the six fields, each carrying a status of confirmed, uncertain or unreadable.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["pages"],
                  properties: {
                    pages: {
                      type: "array",
                      description:
                        "The pages, as images, in the order a person reads them. Sample letters live in data/synthetic-letters/.",
                      items: { type: "string", format: "binary" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "The reading.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      provider: {
                        type: "string",
                        description: "Which reader answered: mock or azure.",
                      },
                      model: { type: "string", nullable: true },
                      result: {
                        type: "object",
                        description:
                          "The extraction contract, src/lib/contract/extraction.ts.",
                        properties: {
                          contract_version: { type: "string", example: "2.0" },
                          provider: { type: "string" },
                          model: { type: "string", nullable: true },
                          fields: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                key: {
                                  type: "string",
                                  enum: [...CONTRACT_FIELD_KEYS],
                                },
                                value: { type: "string", nullable: true },
                                status: {
                                  type: "string",
                                  enum: [
                                    "confirmed",
                                    "uncertain",
                                    "unreadable",
                                  ],
                                },
                                confidence: {
                                  type: "number",
                                  minimum: 0,
                                  maximum: 1,
                                  nullable: true,
                                },
                              },
                            },
                          },
                          open_payload: { type: "object" },
                        },
                      },
                    },
                  },
                  example: {
                    provider: "azure",
                    model: "gpt-5.6-luna",
                    result: {
                      contract_version: "2.0",
                      provider: "azure",
                      model: "gpt-5.6-luna",
                      fields: Object.keys(fieldProperties).map((key) => ({
                        key,
                        value: "...",
                        status: "confirmed",
                        confidence: 0.9,
                      })),
                      open_payload: {},
                    },
                  },
                },
              },
            },
            "400": {
              description: "No pages, too many, too large, or not images.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "500": {
              description:
                "The reader failed, or answered outside the contract. The message says which.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Error: {
          type: "object",
          description: "The shared error envelope, docs/api.md.",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  });
}
