import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), correct: vi.fn() }));
vi.mock("@/server/auth/session", () => ({
  requireUser: mocks.user,
  UnauthenticatedError: class extends Error {},
}));
vi.mock("@/server/email/correction", () => ({
  correctEmailReading: mocks.correct,
  EmailCorrectionRefused: class extends Error {},
}));
import { POST } from "@/app/api/documents/[id]/correct/route";
const id = "11111111-1111-4111-8111-111111111111";
const body = { runId: id, fields: [{ key: "due_date", value: "2026-12-25" }] };
const send = (data: unknown = body, origin = "http://localhost:3000") =>
  POST(
    new Request(`http://localhost:3000/api/documents/${id}/correct`, {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify(data),
    }),
    { params: Promise.resolve({ id }) },
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.correct.mockResolvedValue({ documentId: id });
});
describe("email correction endpoint", () => {
  it("passes validated corrections with the authenticated owner", async () => {
    expect((await send()).status).toBe(200);
    expect(mocks.correct).toHaveBeenCalledWith(id, "owner", body);
  });
  it("rejects a foreign origin before writing", async () => {
    expect((await send(body, "https://foreign.example")).status).toBe(403);
    expect(mocks.correct).not.toHaveBeenCalled();
  });
  it("rejects forged extra keys and malformed fields", async () => {
    expect((await send({ ...body, provider: "azure" })).status).toBe(400);
    expect(
      (await send({ ...body, fields: [{ key: "unknown", value: "x" }] }))
        .status,
    ).toBe(400);
    expect(mocks.correct).not.toHaveBeenCalled();
  });
  it("returns the same missing result for a foreign document", async () => {
    mocks.correct.mockResolvedValue(null);
    expect((await send()).status).toBe(404);
  });
});
