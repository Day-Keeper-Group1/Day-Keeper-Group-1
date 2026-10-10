import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  access: vi.fn(),
  assert: vi.fn(),
}));
vi.mock("@/server/email/gmail/google", () => ({ gmailGet: mocks.get }));
vi.mock("@/server/email/gmail/connection", () => ({
  mailboxAccess: mocks.access,
  assertConnection: mocks.assert,
}));
vi.mock("@/server/email/gmail/http", () => ({
  gmailRoute:
    (handler: (request: Request, user: string) => Promise<Response>) =>
    (request: Request) =>
      handler(request, "owner"),
}));
import { readEmbeddedImages } from "@/server/email/gmail/images";
import { POST } from "@/app/api/email/gmail/images/route";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
  "base64",
);
function message(
  mime = "image/png",
  data: string | undefined = png.toString("base64url"),
  size = png.length,
) {
  return {
    id: "abc123",
    internalDate: "1790208000000",
    payload: {
      mimeType: "multipart/related",
      headers: [{ name: "From", value: "sender@example.com" }],
      parts: [
        {
          mimeType: "text/plain",
          body: { data: Buffer.from("Bill text").toString("base64url") },
        },
        {
          mimeType: "text/html",
          body: {
            data: Buffer.from(
              '<p>Bill</p><img src="cid:logo@example">',
            ).toString("base64url"),
          },
        },
        {
          mimeType: mime,
          headers: [{ name: "Content-ID", value: "<logo@example>" }],
          body: { data, size, attachmentId: "attachment" },
        },
      ],
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({
    token: "private-token",
    connectionId: "connection",
  });
  mocks.get.mockResolvedValue(message());
});
describe("embedded email images", () => {
  it("reads only the user's mailbox and returns referenced raster images", async () => {
    const response = await POST(
      new Request("http://localhost/api/email/gmail/images", {
        method: "POST",
        body: JSON.stringify({ messageId: "abc123" }),
      }),
    );
    const result = await response.json();
    expect(mocks.access).toHaveBeenCalledWith("owner");
    expect(mocks.get).toHaveBeenCalledWith(
      "messages/abc123?format=full",
      "private-token",
    );
    expect(mocks.assert).toHaveBeenCalledWith("owner", "connection");
    expect(result.images["logo%40example"]).toBe(
      `data:image/png;base64,${png.toString("base64")}`,
    );
    expect(result.skipped).toBe(0);
  });
  it("fetches a CID attachment through Gmail, never the sender's URL", async () => {
    const raw = message();
    Object.assign(raw.payload.parts[2].body, { data: undefined });
    mocks.get
      .mockResolvedValueOnce(raw)
      .mockResolvedValueOnce({ data: png.toString("base64url") });
    const result = await readEmbeddedImages("abc123", "token");
    expect(result.skipped).toBe(0);
    expect(mocks.get).toHaveBeenLastCalledWith(
      "messages/abc123/attachments/attachment",
      "token",
    );
  });
  it.each([
    ["image/svg+xml", Buffer.from("<svg/>").toString("base64url"), 6],
    [
      "image/png",
      Buffer.from("<html>not a PNG</html>").toString("base64url"),
      22,
    ],
    ["image/png", png.toString("base64url"), 1_000_001],
  ])(
    "rejects unsafe, mismatched or oversized images (%s)",
    async (mime, data, size) => {
      mocks.get.mockResolvedValue(message(mime, data, size));
      expect(await readEmbeddedImages("abc123", "token")).toEqual({
        images: {},
        skipped: 1,
      });
    },
  );
  it("does not fetch unreferenced attachments", async () => {
    const raw = message();
    raw.payload.parts[2].headers = [
      { name: "Content-ID", value: "<unreferenced>" },
    ];
    mocks.get.mockResolvedValue(raw);
    expect((await readEmbeddedImages("abc123", "token")).images).toEqual({});
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
  it("rejects forged paths before mailbox access", async () => {
    const response = await POST(
      new Request("http://localhost/api/email/gmail/images", {
        method: "POST",
        body: JSON.stringify({ messageId: "../other" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("does not return images after a connection changes", async () => {
    mocks.assert.mockRejectedValue(new Error("Disconnected"));
    await expect(
      POST(
        new Request("http://localhost/api/email/gmail/images", {
          method: "POST",
          body: JSON.stringify({ messageId: "abc123" }),
        }),
      ),
    ).rejects.toThrow("Disconnected");
  });
});
