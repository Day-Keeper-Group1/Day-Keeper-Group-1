import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/server/db", () => ({ queryOne: vi.fn() }));
vi.mock("@/server/email/gmail/connection", () => ({ mailboxAccess: vi.fn() }));
vi.mock("@/server/email/gmail/provider", () => ({
  GmailProvider: class {
    readMessage = readMessage;
  },
}));
const { readMessage } = vi.hoisted(() => ({ readMessage: vi.fn() }));
import { queryOne } from "@/server/db";
import { mailboxAccess } from "@/server/email/gmail/connection";
import { savedEmailMessage } from "@/server/email/source";
const source = {
  mailbox: "original@example.com",
  provider_message_id: "old-message",
  sender: "sender@example.com",
  subject: "Old bill",
  received_at: new Date("2026-05-01T00:00:00Z"),
  text_body: "Saved original",
  connected: false,
};
beforeEach(() => vi.resetAllMocks());
it("scopes saved email lookup to its document and owner", async () => {
  vi.mocked(queryOne).mockResolvedValue(null);
  expect(await savedEmailMessage("document", "owner")).toBeNull();
  expect(queryOne).toHaveBeenCalledWith(
    expect.stringContaining("e.user_id=$2"),
    ["document", "owner"],
  );
  expect(mailboxAccess).not.toHaveBeenCalled();
});
it("opens the retained email without a matching connected mailbox", async () => {
  vi.mocked(queryOne).mockResolvedValue(source);
  expect(await savedEmailMessage("document", "owner")).toMatchObject({
    mailbox: source.mailbox,
    providerMessageId: "old-message",
    textBody: "Saved original",
  });
  expect(mailboxAccess).not.toHaveBeenCalled();
});
it("fetches the exact saved message even outside the recent inbox", async () => {
  vi.mocked(queryOne).mockResolvedValue({ ...source, connected: true });
  vi.mocked(mailboxAccess).mockResolvedValue({
    token: "test",
    connectionId: "connection",
  });
  readMessage.mockResolvedValue({
    providerMessageId: "old-message",
    sanitizedHtmlBody: "<p>Original</p>",
  });
  expect(await savedEmailMessage("document", "owner")).toMatchObject({
    mailbox: source.mailbox,
    sanitizedHtmlBody: "<p>Original</p>",
  });
  expect(readMessage).toHaveBeenCalledWith("old-message");
});
it("falls back to saved text when Gmail is unavailable", async () => {
  vi.mocked(queryOne).mockResolvedValue({ ...source, connected: true });
  vi.mocked(mailboxAccess).mockRejectedValue(new Error("Unavailable"));
  expect(await savedEmailMessage("document", "owner")).toMatchObject({
    textBody: "Saved original",
  });
});
