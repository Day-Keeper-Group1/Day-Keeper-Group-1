import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);
import { db } from "@/server/db";
import * as email from "@/server/db/queries/email";
import { createEmailDocument } from "@/server/email/import";
import { correctEmailReading } from "@/server/email/correction";
import { getDocument, listDocuments } from "@/server/documents";
import { readDocument } from "@/server/uploads";
import { EMAIL_FAILURE_MESSAGES } from "@/lib/contract/api";
import { aPerson, aReading, type Person } from "./support/world";
import { resetFakes } from "./support/fakes";
import { rows } from "./support/witness";

const message = {
  providerMessageId: "bill-1",
  from: "water@example.com",
  subject: "Water bill",
  receivedAt: "2026-10-05T00:00:00Z",
  textBody: "Pay $10 by 8 November 2026",
};
const result = aReading({
  document_type: "Bill",
  issuer: "Water",
  action_required: "Pay Water",
  due_date: { value: "2026-11-08", status: "uncertain" },
  amount: "$10",
  reference: "Not applicable",
});
let owner: Person, stranger: Person, connectionId: string;
beforeEach(async () => {
  resetFakes();
  owner = await aPerson("Margaret");
  stranger = await aPerson("Agnes");
  connectionId = randomUUID();
  await email.insertGmailConnection(
    db(),
    owner.id,
    owner.email,
    "encrypted",
    connectionId,
  );
  await email.insertOauthAttempt(db(), owner.id, {
    state_hash: "state",
    browser_hash: "browser",
    verifier_encrypted: "verifier",
    expires_at: new Date(Date.now() + 60_000),
  });
});

describe("retained emails after the database merge", () => {
  it("deduplicates selected messages and rejects a changed connection", async () => {
    const first = await createEmailDocument(
      owner.id,
      connectionId,
      owner.email,
      message,
    );
    expect(first.queued).toBe(true);
    expect(
      await createEmailDocument(owner.id, connectionId, owner.email, message),
    ).toEqual({ ...first, queued: false });
    await expect(
      createEmailDocument(stranger.id, connectionId, owner.email, message),
    ).rejects.toThrow("connection changed");
  });

  it("preserves failure explanations and allows an owned correction once", async () => {
    const { documentId } = await createEmailDocument(
      owner.id,
      connectionId,
      owner.email,
      message,
    );
    await readDocument(documentId, owner.id, [], {
      pauseMs: 0,
      read: async () => ({
        result,
        call: {
          provider: "test-email",
          model: "mock",
          effort: "medium",
          seconds: 0,
          usage: null,
        },
      }),
    });
    const detail = await getDocument(documentId, owner.id, owner.timeZone);
    expect(detail?.sourceEmail?.textBody).toBe(message.textBody);
    expect(detail?.failure?.message).toBe(EMAIL_FAILURE_MESSAGES["due-date"]);
    expect(
      (await listDocuments(owner.id, owner.timeZone))[0].failure?.message,
    ).toBe(EMAIL_FAILURE_MESSAGES["due-date"]);
    expect(
      await getDocument(documentId, stranger.id, stranger.timeZone),
    ).toBeNull();
    const request = {
      runId: detail!.correction!.runId,
      fields: [{ key: "due_date" as const, value: "2026-11-08" }],
    };
    expect(
      await correctEmailReading(documentId, stranger.id, request),
    ).toBeNull();
    expect(await correctEmailReading(documentId, owner.id, request)).toEqual({
      documentId,
    });
    expect(
      (await getDocument(documentId, owner.id, owner.timeZone))?.status,
    ).toBe("needs-review");
    await expect(
      correctEmailReading(documentId, owner.id, request),
    ).rejects.toThrow("changed");
  });

  it("scopes every email lookup and existing-row writer to the owner", async () => {
    const { documentId } = await createEmailDocument(
      owner.id,
      connectionId,
      owner.email,
      message,
    );
    await readDocument(documentId, owner.id, [], {
      pauseMs: 0,
      read: async () => ({
        result,
        call: {
          provider: "test-email",
          model: "mock",
          effort: "medium",
          seconds: 0,
          usage: null,
        },
      }),
    });
    const run = (await email.findOwnedFailedEmailRound(
      db(),
      owner.id,
      documentId,
    ))!;
    const snapshot = () =>
      rows(
        "SELECT row_to_json(e) AS value FROM document_emails e UNION ALL SELECT row_to_json(c) FROM gmail_connections c UNION ALL SELECT row_to_json(a) FROM gmail_oauth_attempts a UNION ALL SELECT row_to_json(r) FROM extraction_runs r UNION ALL SELECT row_to_json(d) FROM documents d",
      );
    const before = await snapshot();
    expect(
      await email.findOwnedGmailConnection(db(), stranger.id, connectionId),
    ).toBeNull();
    expect(
      await email.findOwnedOauthAttempt(
        db(),
        stranger.id,
        "state",
        "browser",
        true,
      ),
    ).toBeNull();
    expect(
      await email.findOwnedEmail(db(), stranger.id, documentId),
    ).toBeNull();
    expect(
      await email.findOwnedEmailDocument(
        db(),
        stranger.id,
        owner.email,
        message.providerMessageId,
      ),
    ).toBeNull();
    expect(
      await email.findOwnedFailedEmailRound(db(), stranger.id, documentId),
    ).toBeNull();
    expect(await email.listOwnedEmailCalls(db(), stranger.id, run.id)).toEqual(
      [],
    );
    expect(
      await email.insertOwnedCorrectedEmailRound(
        db(),
        stranger.id,
        documentId,
        result,
      ),
    ).toBeNull();
    await email.rotateOwnedGmailToken(
      db(),
      stranger.id,
      connectionId,
      "changed",
    );
    await email.saveOwnedEmail(
      db(),
      stranger.id,
      documentId,
      owner.email,
      message,
      true,
    );
    await email.deleteOwnedGmailAccess(db(), stranger.id);
    expect(await snapshot()).toEqual(before);
    expect(
      await email.findOwnedGmailConnection(db(), owner.id, connectionId),
    ).not.toBeNull();
    expect(
      await email.findOwnedOauthAttempt(db(), owner.id, "state", "browser"),
    ).not.toBeNull();
    expect(
      await email.findOwnedEmail(db(), owner.id, documentId),
    ).not.toBeNull();
    expect(
      await email.findOwnedEmailDocument(
        db(),
        owner.id,
        owner.email,
        message.providerMessageId,
      ),
    ).not.toBeNull();
    expect(
      await email.listOwnedEmailCalls(db(), owner.id, run.id),
    ).toHaveLength(2);
    await email.rotateOwnedGmailToken(db(), owner.id, connectionId, "changed");
    expect(
      (await email.findOwnedGmailConnection(db(), owner.id))
        ?.refresh_token_encrypted,
    ).toBe("changed");
    await email.deleteOwnedGmailAccess(db(), owner.id);
    expect(await email.findOwnedGmailConnection(db(), owner.id)).toBeNull();
    expect(
      await email.findOwnedOauthAttempt(db(), owner.id, "state", "browser"),
    ).toBeNull();
  });
});
