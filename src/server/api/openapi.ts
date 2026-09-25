// KAN-67: the OpenAPI description behind /api-docs, one entry for every route handler.

import { CONTRACT_FIELD_KEYS } from "@/lib/contract/fields";

import examples from "./openapi-examples.json";

/**
 * The Swagger page's description of the API.
 *
 * docs/api.md stays the specification: it has the rules and the reasons. This
 * file is what lets a browser call each endpoint and see what comes back, so an
 * entry carries a summary, what to send, a response the running app actually
 * gave (./openapi-examples.json), the error codes, and a link to its section of
 * docs/api.md. The schemas name the shapes in src/lib/contract/api.ts and do not
 * try to restate every rule written there.
 *
 * tests/openapi.test.ts fails when a route handler under src/app/api is not
 * described here, or this file describes one that does not exist.
 */

const API_MD =
  "https://github.com/Day-Keeper-Group1/Day-Keeper-Group-1/blob/main/docs/api.md";

type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`,
});

/** A JSON response with an example taken from the running app. */
function answer(description: string, schema: Schema, example: unknown) {
  return {
    description,
    content: { "application/json": { schema, example } },
  };
}

/** An error response in the shared envelope. */
function refusal(description: string, example: unknown) {
  return answer(description, ref("Error"), example);
}

const NOT_SIGNED_IN = refusal(
  "Not signed in. Try POST /api/auth/login first.",
  examples.unauthenticated,
);

const ID = (description: string) => ({
  name: "id",
  in: "path",
  required: true,
  description,
  schema: { type: "string", format: "uuid" },
});

/** The link under each entry to the section of docs/api.md that explains it. */
const specified = (text: string, anchor: string) =>
  `${text}\n\nSpecified in [docs/api.md](${API_MD}#${anchor}).`;

const paths = {
  "/api/email/gmail/connect": {
    post: {
      tags: ["Gmail"],
      summary: "Connect Gmail",
      description: specified(
        "Requires the configured callback Origin. Starts a ten-minute, single-use OAuth attempt bound to the browser and signed-in user, with PKCE. Use the controls at /email to follow Google consent.",
        "gmail-development-endpoints",
      ),
      security: [{ session: [] }],
      responses: {
        303: {
          description:
            "Redirect to Google consent; sets the OAuth browser cookie.",
        },
        401: NOT_SIGNED_IN,
        403: { description: "Foreign Origin." },
        500: { description: "Configuration or provider failure." },
      },
    },
  },
  "/api/email/gmail/callback": {
    get: {
      tags: ["Gmail"],
      summary: "Finish Gmail connection",
      description: specified(
        "Consumes the OAuth state and browser cookie, verifies read scope and stores the encrypted refresh token. No message bodies are stored.",
        "gmail-development-endpoints",
      ),
      security: [{ session: [] }],
      parameters: ["state", "code", "error"].map((name) => ({
        name,
        in: "query",
        required: false,
        schema: { type: "string" },
      })),
      responses: {
        303: {
          description: "Redirect to /email?connection=connected or failed.",
        },
        401: NOT_SIGNED_IN,
        500: { description: "Configuration or provider failure." },
      },
    },
  },
  "/api/email/gmail/status": {
    get: {
      tags: ["Gmail"],
      summary: "Get Gmail connection status",
      security: [{ session: [] }],
      responses: {
        200: answer(
          "Private connection status; never includes tokens.",
          {
            type: "object",
            properties: {
              configured: { type: "boolean" },
              connected: { type: "boolean" },
              email: { type: "string", nullable: true },
            },
          },
          { configured: true, connected: false, email: null },
        ),
        401: NOT_SIGNED_IN,
        500: { description: "Configuration or provider failure." },
      },
    },
  },
  "/api/email/gmail/messages": {
    post: {
      tags: ["Gmail"],
      summary: "Read recent Gmail messages",
      description: specified(
        "Requires the configured callback Origin. Reads the first 20 inbox messages within 30 days, accepting plain-text bodies only. Unsupported messages count toward skipped. Bodies are neither persisted nor sent to AI. Replies use Cache-Control: no-store.",
        "gmail-development-endpoints",
      ),
      security: [{ session: [] }],
      responses: {
        200: answer(
          "Recent messages.",
          {
            type: "object",
            properties: {
              messages: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "providerMessageId",
                    "from",
                    "subject",
                    "receivedAt",
                    "textBody",
                  ],
                  properties: {
                    providerMessageId: { type: "string" },
                    from: { type: "string", format: "email" },
                    subject: { type: "string", maxLength: 2000 },
                    receivedAt: { type: "string", format: "date-time" },
                    textBody: {
                      type: "string",
                      minLength: 1,
                      maxLength: 100000,
                    },
                  },
                },
              },
              skipped: { type: "integer" },
              hasMore: { type: "boolean" },
            },
          },
          { messages: [], skipped: 0, hasMore: false },
        ),
        401: NOT_SIGNED_IN,
        403: { description: "Foreign Origin." },
        409: { description: "Reconnect Gmail." },
        500: { description: "Configuration or provider failure." },
      },
    },
  },
  "/api/email/gmail/disconnect": {
    post: {
      tags: ["Gmail"],
      summary: "Disconnect Gmail",
      description: specified(
        "Requires the configured callback Origin. Deletes the user's token and pending connection attempts. The Google grant can also be removed in Google account settings.",
        "gmail-development-endpoints",
      ),
      security: [{ session: [] }],
      responses: {
        200: answer(
          "Disconnected.",
          {
            type: "object",
            properties: { disconnected: { type: "boolean", enum: [true] } },
          },
          { disconnected: true },
        ),
        401: NOT_SIGNED_IN,
        403: { description: "Foreign Origin." },
        500: { description: "Configuration or provider failure." },
      },
    },
  },
  "/api/auth/register": {
    post: {
      tags: ["Signing in"],
      summary: "Create an account",
      description: specified(
        "Creates a person and signs them in, so the session cookie is set on success. The password rule is length only: 8 to 200 characters.",
        "create-an-account",
      ),
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password", "displayName"],
              properties: {
                email: { type: "string", format: "email" },
                password: { type: "string", minLength: 8, maxLength: 200 },
                displayName: { type: "string" },
              },
            },
            example: {
              email: "new.person@example.com",
              password: "the pot plant by the door",
              displayName: "New Person",
            },
          },
        },
      },
      responses: {
        "201": answer(
          "Created and signed in.",
          ref("SessionUser"),
          examples.sessionUser,
        ),
        "400": refusal(
          "A field is missing or breaks its rule; `fields` says which.",
          examples.registerInvalid,
        ),
        "409": refusal(
          "That address already has an account.",
          examples.registerConflict,
        ),
      },
    },
  },
  "/api/auth/login": {
    post: {
      tags: ["Signing in"],
      summary: "Sign in",
      description: specified(
        "Exchanges an email and password for a session. The session cookie is set on success, and this page sends it with every request after, so sign in here before trying the endpoints that need it. A wrong address and a wrong password get the same answer.",
        "sign-in",
      ),
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", format: "email" },
                password: { type: "string" },
              },
            },
            example: { email: "margaret@example.com", password: "daykeeper" },
          },
        },
      },
      responses: {
        "200": answer("Signed in.", ref("SessionUser"), examples.sessionUser),
        "400": refusal("The email or the password is empty.", {
          error: {
            code: "invalid_request",
            message: "Please fill in both boxes.",
            fields: { password: "Please enter your password." },
          },
        }),
        "401": refusal(
          "The email and password do not match.",
          examples.loginWrong,
        ),
      },
    },
  },
  "/api/auth/logout": {
    post: {
      tags: ["Signing in"],
      summary: "Sign out",
      description: specified(
        "Ends the session everywhere, not only in this browser, by deleting its row.",
        "sign-out",
      ),
      security: [{ session: [] }],
      responses: {
        "200": answer(
          "Signed out.",
          {
            type: "object",
            properties: { signedOut: { type: "boolean", enum: [true] } },
          },
          examples.signedOut,
        ),
        "401": NOT_SIGNED_IN,
      },
    },
  },
  "/api/auth/me": {
    get: {
      tags: ["Signing in"],
      summary: "Who is signed in",
      description: specified(
        "What the interface asks on load. Nobody signed in is a normal state, so it answers 200 with `user: null` rather than 401.",
        "who-is-signed-in",
      ),
      responses: {
        "200": {
          description: "The signed-in person, or null.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  user: { ...ref("SessionUser"), nullable: true },
                },
              },
              examples: {
                signedIn: { summary: "Signed in", value: examples.me },
                signedOut: {
                  summary: "Nobody signed in",
                  value: examples.meAnonymous,
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/documents": {
    post: {
      tags: ["Letters"],
      summary: "Upload a letter",
      description: specified(
        "Stores the photographs of ONE letter, in page order, and answers at once with the letter at `processing`. The reading happens after the response; poll GET /api/home, or GET /api/documents/{id}, to see it become `needs-review` or `failed`. Sample letters are in data/synthetic-letters/.",
        "upload-a-letter",
      ),
      security: [{ session: [] }],
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
                    "The pages, as images, in the order a person reads them.",
                  items: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
      },
      responses: {
        "201": answer(
          "Stored. Nothing has read it yet.",
          ref("DocumentSummary"),
          examples.uploaded,
        ),
        "400": refusal(
          "No photographs, too many, one too large, or one that is not an image. The whole upload is refused.",
          examples.uploadInvalid,
        ),
        "401": NOT_SIGNED_IN,
      },
    },
    get: {
      tags: ["Letters"],
      summary: "List letters",
      description: specified(
        "Every letter this person has, in every status, newest upload first.",
        "list-letters",
      ),
      security: [{ session: [] }],
      responses: {
        "200": answer(
          "The letters.",
          { type: "array", items: ref("DocumentSummary") },
          examples.documents,
        ),
        "401": NOT_SIGNED_IN,
      },
    },
  },
  "/api/documents/{id}": {
    get: {
      tags: ["Letters"],
      summary: "One letter, in full",
      description: specified(
        "The letter, the fields its reading produced, the numbers it prints, and its pages. `fields` is empty while the letter is still being read.",
        "one-letter-in-full",
      ),
      security: [{ session: [] }],
      parameters: [ID("The letter's id, from GET /api/documents.")],
      responses: {
        "200": answer("The letter.", ref("DocumentDetail"), examples.document),
        "401": NOT_SIGNED_IN,
        "404": refusal(
          "No such letter, or it belongs to somebody else.",
          examples.documentNotFound,
        ),
      },
    },
  },
  "/api/documents/{id}/confirm": {
    post: {
      tags: ["Letters"],
      summary: "Confirm a letter",
      description: specified(
        "The person looked and said it was right. The body is empty. The letter is saved and, unless it asks for nothing, becomes a task with its reminders. Only a letter at `needs-review` can be confirmed.",
        "confirm-a-letter",
      ),
      security: [{ session: [] }],
      parameters: [ID("A letter at needs-review.")],
      responses: {
        "200": answer(
          "Saved. `task` is null for a letter that asks for nothing. No reminders here because this sample bill was already past its due date.",
          ref("ConfirmDocumentResponse"),
          examples.confirmed,
        ),
        "401": NOT_SIGNED_IN,
        "404": refusal(
          "No such letter, or it belongs to somebody else.",
          examples.documentNotFound,
        ),
        "409": refusal(
          "The letter is not waiting to be checked: already saved, still being read, or its reading failed.",
          examples.confirmConflict,
        ),
      },
    },
  },
  "/api/documents/{id}/pages/{page}": {
    get: {
      tags: ["Letters"],
      summary: "A page image",
      description: specified(
        "Checks who is asking, then redirects to a link storage signed for a short time. Swagger shows the redirect's target image, or an error if the browser will not follow it; opening the path in a new tab shows the photograph.",
        "a-page-image",
      ),
      security: [{ session: [] }],
      parameters: [
        ID("The letter's id."),
        {
          name: "page",
          in: "path",
          required: true,
          description: "The page number as a person counts it, from 1.",
          schema: { type: "integer", minimum: 1 },
        },
      ],
      responses: {
        "302": {
          description:
            "Found. `Location` is the signed link to the photograph.",
          headers: {
            Location: {
              schema: { type: "string" },
              example: examples.pageLocation,
            },
          },
        },
        "401": NOT_SIGNED_IN,
        "404": refusal(
          "No such page, or the letter belongs to somebody else.",
          {
            error: { code: "not_found", message: "Page not found." },
          },
        ),
      },
    },
  },
  "/api/tasks": {
    get: {
      tags: ["Tasks"],
      summary: "List tasks",
      description: specified(
        "Every task this person has, by due date with dateless ones last, each with its reminders. Uncapped, because the calendar is drawn from it. `status` is worked out from the due date when asked.",
        "list-tasks",
      ),
      security: [{ session: [] }],
      responses: {
        "200": answer(
          "The tasks. The example shows the first two.",
          { type: "array", items: ref("TaskSummary") },
          examples.tasks,
        ),
        "401": NOT_SIGNED_IN,
      },
    },
  },
  "/api/tasks/{id}": {
    get: {
      tags: ["Tasks"],
      summary: "One task, in full",
      description: specified(
        "What the calendar's day sheet draws: the task, the fields of the letter it came from, and how many photographs that letter has.",
        "one-task-in-full",
      ),
      security: [{ session: [] }],
      parameters: [ID("The task's id, from GET /api/tasks.")],
      responses: {
        "200": answer("The task.", ref("TaskDetail"), examples.task),
        "401": NOT_SIGNED_IN,
        "404": refusal("No such task, or it belongs to somebody else.", {
          error: { code: "not_found", message: "Task not found." },
        }),
      },
    },
  },
  "/api/tasks/{id}/complete": {
    post: {
      tags: ["Tasks"],
      summary: "Tick a task off",
      description: specified(
        "Marks the task done. No reminder row changes: a reminder checks the task when its time comes, and does not send for a done task.",
        "tick-a-task-off",
      ),
      security: [{ session: [] }],
      parameters: [ID("The task's id.")],
      responses: {
        "200": answer("Done.", ref("TaskSummary"), examples.taskCompleted),
        "401": NOT_SIGNED_IN,
        "404": refusal("No such task, or it belongs to somebody else.", {
          error: { code: "not_found", message: "Task not found." },
        }),
      },
    },
    delete: {
      tags: ["Tasks"],
      summary: "Undo the tick",
      description: specified(
        "Puts a ticked task back on the list, however long ago it was ticked. A task past its due date comes back `overdue`.",
        "undo-that",
      ),
      security: [{ session: [] }],
      parameters: [ID("The task's id.")],
      responses: {
        "200": answer("Open again.", ref("TaskSummary"), examples.taskReopened),
        "401": NOT_SIGNED_IN,
        "404": refusal("No such task, or it belongs to somebody else.", {
          error: { code: "not_found", message: "Task not found." },
        }),
      },
    },
  },
  "/api/home": {
    get: {
      tags: ["Home screen"],
      summary: "Everything the home screen needs",
      description: specified(
        "The counts, the letters still to deal with, and the tasks, in one request so they cannot disagree on screen. It is also what the interface polls while a letter is being read.",
        "everything-the-home-screen-needs",
      ),
      security: [{ session: [] }],
      responses: {
        "200": answer(
          "The home screen. The example shows the first task.",
          ref("HomePayload"),
          examples.home,
        ),
        "401": NOT_SIGNED_IN,
      },
    },
  },
  "/api/dev/extract": {
    post: {
      tags: ["Development"],
      summary: "Read a letter once, without storing it",
      description: specified(
        "Send one or more photographed pages of ONE letter, in reading order. The reader named by AI_EXTRACTION_PROVIDER reads it once and answers with the six fields, each carrying a status of confirmed, uncertain or unreadable. No sign-in, nothing stored, and not available in production. Uploading through POST /api/documents is how the product reads a letter.",
        "development-only-try-the-reader",
      ),
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
        "200": answer(
          "The reading.",
          {
            type: "object",
            properties: {
              call: {
                type: "object",
                description:
                  "The call's own record, written by the code and not by the model.",
                properties: {
                  provider: {
                    type: "string",
                    description: "Which reader answered: mock or azure.",
                  },
                  model: { type: "string", nullable: true },
                  effort: {
                    type: "string",
                    nullable: true,
                    description: "The reasoning effort; null for the mock.",
                  },
                  seconds: { type: "number" },
                  usage: {
                    type: "object",
                    nullable: true,
                    description:
                      "Tokens as the provider reported them. output_tokens already includes reasoning_tokens.",
                    properties: {
                      input_tokens: { type: "integer" },
                      cached_tokens: {
                        type: "integer",
                        description:
                          "The part of input_tokens served from Azure's cache.",
                      },
                      reasoning_tokens: { type: "integer" },
                      output_tokens: { type: "integer" },
                    },
                  },
                },
              },
              result: ref("ExtractionResult"),
            },
          },
          {
            call: {
              provider: "azure",
              model: "gpt-5.6-luna",
              effort: "medium",
              seconds: 12.1,
              usage: {
                input_tokens: 25077,
                cached_tokens: 0,
                reasoning_tokens: 216,
                output_tokens: 589,
              },
            },
            result: {
              contract_version: "2.0",
              provider: "azure",
              model: "gpt-5.6-luna",
              // What the azure reader returned for
              // data/synthetic-letters/01-electricity-bill.
              fields: [
                {
                  key: "document_type",
                  value: "electricity bill",
                  status: "confirmed",
                  confidence: 0.95,
                },
                {
                  key: "issuer",
                  value: "Example Energy",
                  status: "confirmed",
                  confidence: 0.95,
                },
                {
                  key: "action_required",
                  value: "Pay Example Energy",
                  status: "confirmed",
                  confidence: 0.95,
                },
                {
                  key: "due_date",
                  value: "2026-08-24",
                  status: "confirmed",
                  confidence: 0.95,
                },
                {
                  key: "amount",
                  value: "$82.42",
                  status: "confirmed",
                  confidence: 0.95,
                },
                {
                  key: "reference",
                  value: "7960 963 636",
                  status: "confirmed",
                  confidence: 0.95,
                },
              ],
              identifiers: [
                {
                  label: "Account number",
                  value: "7960 963 636",
                  status: "confirmed",
                },
                { label: "NMI", value: "60371335118", status: "confirmed" },
              ],
              open_payload: {},
            },
          },
        ),
        "400": refusal("No pages, too many, too large, or not images.", {
          error: {
            code: "invalid_request",
            message: 'Attach at least one page as the multipart field "pages".',
          },
        }),
        "500": refusal(
          "The reader failed, or answered outside the contract. The message says which.",
          {
            error: {
              code: "server_error",
              message:
                "The reader failed: AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must both be set",
            },
          },
        ),
      },
    },
  },
};

const DATE = { type: "string", format: "date", example: "2026-09-21" };
const TIME = { type: "string", pattern: "^\\d{2}:\\d{2}$", example: "10:30" };

const schemas: Record<string, Schema> = {
  Error: {
    type: "object",
    description:
      "The one error shape every endpoint uses. `message` is written to be shown to a person as it is.",
    properties: {
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            enum: [
              "unauthenticated",
              "forbidden",
              "not_found",
              "invalid_request",
              "conflict",
              "server_error",
            ],
          },
          message: { type: "string" },
          fields: {
            type: "object",
            description: "Problems with single fields, keyed by field name.",
            additionalProperties: { type: "string" },
          },
        },
      },
    },
  },
  SessionUser: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      email: { type: "string" },
      displayName: { type: "string" },
      role: {
        type: "string",
        enum: ["user", "platform_operator", "org_admin", "org_worker"],
      },
      timeZone: { type: "string", example: "Australia/Melbourne" },
    },
  },
  DocumentSummary: {
    type: "object",
    description:
      "One letter in a list. `issuer` and `documentType` are null until a reading has succeeded.",
    properties: {
      id: { type: "string", format: "uuid" },
      issuer: { type: "string", nullable: true },
      documentType: { type: "string", nullable: true },
      label: {
        type: "string",
        description: "What to call this row, always present.",
      },
      status: {
        type: "string",
        enum: ["processing", "needs-review", "confirmed", "failed", "archived"],
      },
      dueDate: DATE,
      dueTime: TIME,
      amount: { type: "string" },
      reference: { type: "string" },
      uploadedAt: { type: "string", format: "date-time" },
      pageCount: { type: "integer" },
      failure: {
        type: "object",
        description: "Present exactly when status is failed.",
        properties: { message: { type: "string" } },
      },
    },
  },
  FieldView: {
    type: "object",
    description:
      "One row of a reading as a screen shows it. `value` is null exactly when the status is unreadable.",
    properties: {
      key: { type: "string", example: "due_date" },
      label: { type: "string", example: "Due date" },
      value: { type: "string", nullable: true },
      status: { type: "string", enum: ["confirmed", "unreadable"] },
    },
  },
  IdentifierView: {
    type: "object",
    description:
      "A number the letter prints, under the label printed beside it. `isReference` marks the one to quote.",
    properties: {
      label: { type: "string" },
      value: { type: "string" },
      isReference: { type: "boolean" },
    },
  },
  DocumentDetail: {
    allOf: [
      ref("DocumentSummary"),
      {
        type: "object",
        properties: {
          fields: { type: "array", items: ref("FieldView") },
          identifiers: { type: "array", items: ref("IdentifierView") },
          pages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                pageNumber: { type: "integer" },
                url: { type: "string" },
              },
            },
          },
        },
      },
    ],
  },
  ReminderView: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      scheduledFor: { type: "string", format: "date-time" },
      localDate: DATE,
      localTime: TIME,
      channel: { type: "string", enum: ["in_app", "email"] },
      status: {
        type: "string",
        enum: ["scheduled", "sent", "skipped", "failed"],
      },
    },
  },
  TaskSummary: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      title: { type: "string" },
      documentId: { type: "string", format: "uuid" },
      issuer: { type: "string", nullable: true },
      dueDate: { ...DATE, nullable: true },
      dueTime: TIME,
      status: { type: "string", enum: ["upcoming", "overdue", "completed"] },
      reminders: { type: "array", items: ref("ReminderView") },
    },
  },
  TaskDetail: {
    allOf: [
      ref("TaskSummary"),
      {
        type: "object",
        properties: {
          fields: { type: "array", items: ref("FieldView") },
          identifiers: { type: "array", items: ref("IdentifierView") },
          pageCount: { type: "integer" },
        },
      },
    ],
  },
  ConfirmDocumentResponse: {
    type: "object",
    properties: {
      documentId: { type: "string", format: "uuid" },
      task: { ...ref("TaskSummary"), nullable: true },
    },
  },
  HomePayload: {
    type: "object",
    properties: {
      counts: {
        type: "object",
        properties: {
          needsReview: { type: "integer" },
          processing: { type: "integer" },
          failed: { type: "integer" },
        },
      },
      inbox: { type: "array", items: ref("DocumentSummary") },
      tasks: { type: "array", items: ref("TaskSummary") },
    },
  },
  ExtractionResult: {
    type: "object",
    description: "The extraction contract, src/lib/contract/extraction.ts.",
    properties: {
      contract_version: { type: "string", example: "2.0" },
      provider: { type: "string" },
      model: { type: "string", nullable: true },
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", enum: [...CONTRACT_FIELD_KEYS] },
            value: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["confirmed", "uncertain", "unreadable"],
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
      identifiers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            status: { type: "string", enum: ["confirmed", "uncertain"] },
          },
        },
      },
      open_payload: { type: "object" },
    },
  },
};

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "DayKeeper API",
    version: "0.2.0",
    description: `Every endpoint the product has. To try the ones that need a session, open **Signing in**, run POST /api/auth/login with the example body (margaret@example.com / daykeeper), and the browser keeps the cookie for every call after.\n\nThe specification, with the rules and the reasons, is [docs/api.md](${API_MD}). Development only: this page answers 404 in production.`,
  },
  tags: [
    {
      name: "Gmail",
      description:
        "Connect and read Gmail in the Module 2 prototype. All replies are private and use Cache-Control: no-store.",
    },
    {
      name: "Signing in",
      description: "Accounts and sessions. Start here.",
    },
    { name: "Letters", description: "Photograph a letter, check it, save it." },
    { name: "Tasks", description: "What a saved letter asks for." },
    {
      name: "Home screen",
      description: "Everything the home screen draws, in one request.",
    },
    {
      name: "Development",
      description: "Try the reader without storing anything.",
    },
  ],
  paths,
  components: {
    securitySchemes: {
      session: {
        type: "apiKey",
        in: "cookie",
        name: "dk_session",
        description:
          "Set by POST /api/auth/login or POST /api/auth/register, and sent by the browser on its own.",
      },
    },
    schemas,
  },
};
