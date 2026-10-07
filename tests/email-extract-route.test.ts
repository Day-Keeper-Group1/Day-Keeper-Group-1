import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  access: vi.fn(),
  readMessage: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  requireReader: vi.fn(),
  budget: vi.fn(),
}));
vi.mock("@/server/ai/school-key", () => ({
  schoolKeyBudget: mocks.budget,
  READING_PAUSED_MESSAGE: "Reading is paused until tomorrow.",
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/server/email/gmail/http", () => ({
  gmailRoute:
    (handler: (request: Request, userId: string) => Promise<Response>) =>
    (request: Request) =>
      handler(request, "owner"),
}));
vi.mock("@/server/email/gmail/connection", () => ({
  mailboxAccess: mocks.access,
}));
vi.mock("@/server/email/gmail/provider", () => ({
  GmailProvider: class {
    readMessage = mocks.readMessage;
  },
}));
vi.mock("@/server/email/extraction", () => ({
  requireEmailReader: mocks.requireReader,
}));
vi.mock("@/server/email/import", () => ({
  createEmailDocument: mocks.create,
  readEmailDocument: mocks.read,
}));
import { POST } from "@/app/api/email/gmail/extract/route";
const send = (body: unknown) =>
  POST(
    new Request("http://localhost:3000/api/email/gmail/extract", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.budget.mockResolvedValue({ exhausted: false });
  mocks.access.mockResolvedValue({
    token: "access",
    connectionId: "connection",
  });
  mocks.readMessage.mockResolvedValue({
    providerMessageId: "abc123",
    textBody: "Fetched from Gmail",
  });
  mocks.create.mockResolvedValue({ documentId: "document", queued: true });
});
describe("selected email endpoint", () => {
  it("refuses exhausted budgets before fetching or saving mail", async () => {
    mocks.budget.mockResolvedValue({ exhausted: true });
    const response = await send({
      messageId: "abc123",
      mailbox: "owner@example.com",
    });
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: { message: "Reading is paused until tomorrow." },
    });
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("fetches the selected message server-side for the signed-in owner and schedules reading after response", async () => {
    const response = await send({
      messageId: "abc123",
      mailbox: "owner@example.com",
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ documentId: "document" });
    expect(mocks.access).toHaveBeenCalledWith("owner");
    expect(mocks.readMessage).toHaveBeenCalledWith("abc123");
    expect(mocks.create).toHaveBeenCalledWith(
      "owner",
      "connection",
      "owner@example.com",
      expect.objectContaining({ textBody: "Fetched from Gmail" }),
    );
    expect(mocks.read).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.read).toHaveBeenCalledWith(
      "document",
      "owner",
      expect.objectContaining({ textBody: "Fetched from Gmail" }),
    );
  });
  it.each([
    { messageId: "../other", mailbox: "owner@example.com" },
    {
      messageId: "abc123",
      mailbox: "owner@example.com",
      textBody: "Forged text",
    },
    {},
  ])(
    "rejects invalid identifiers and browser-supplied bodies",
    async (body) => {
      expect((await send(body)).status).toBe(400);
      expect(mocks.access).not.toHaveBeenCalled();
      expect(mocks.after).not.toHaveBeenCalled();
    },
  );
  it("does not schedule a duplicate reading", async () => {
    mocks.create.mockResolvedValue({ documentId: "document", queued: false });
    expect(
      (await send({ messageId: "abc123", mailbox: "owner@example.com" }))
        .status,
    ).toBe(202);
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("does not save unsupported messages", async () => {
    mocks.readMessage.mockResolvedValue(null);
    expect(
      (await send({ messageId: "abc123", mailbox: "owner@example.com" }))
        .status,
    ).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
