import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchoolKeyExhausted } from "@/server/ai/school-key";
import { UnauthenticatedError } from "@/server/auth/session";
import { voiceExtractionResponseSchema } from "@/lib/contract/voice";
import { voiceScenario } from "@/server/voice/scenarios";

const { extract, requireUser, selectProvider } = vi.hoisted(() => ({
  extract: vi.fn(),
  requireUser: vi.fn(),
  selectProvider: vi.fn(),
}));

vi.mock("@/server/auth/session", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/auth/session")>();
  return { ...original, requireUser };
});

vi.mock("@/server/voice", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/voice")>();
  return {
    ...original,
    commitmentExtractionProvider: selectProvider,
  };
});

import { POST } from "@/app/api/conversations/extract/route";

function request(body: unknown) {
  return new Request("http://localhost/api/conversations/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("fictional conversation extraction API", () => {
  beforeEach(() => {
    extract.mockReset();
    requireUser.mockReset().mockResolvedValue({ id: "test-user" });
    selectProvider.mockReset().mockReturnValue({
      name: "mock",
      model: null,
      extract,
    });
  });

  it("refuses unknown scenarios before calling a provider", async () => {
    const response = await POST(request({ scenarioId: "real-person" }));
    expect(response.status).toBe(400);
    expect(extract).not.toHaveBeenCalled();
  });

  it("refuses unexpected request fields", async () => {
    const response = await POST(
      request({ scenarioId: "clear", transcript: "private conversation" }),
    );
    expect(response.status).toBe(400);
    expect(extract).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    requireUser.mockRejectedValue(new UnauthenticatedError());
    const response = await POST(request({ scenarioId: "clear" }));
    expect(response.status).toBe(401);
    expect(extract).not.toHaveBeenCalled();
  });

  it("passes only the server-side fixture and returns validated data", async () => {
    const scenario = voiceScenario("clear")!;
    extract.mockResolvedValue({
      payload: scenario.expected,
      model: null,
      effort: null,
      usage: null,
      seconds: 0.2,
    });
    const response = await POST(request({ scenarioId: "clear" }));
    expect(response.status).toBe(200);
    expect(extract).toHaveBeenCalledWith(scenario.transcript);
    expect(selectProvider).toHaveBeenCalledWith(undefined);
    expect(voiceExtractionResponseSchema.parse(await response.json())).toEqual({
      provider: "mock",
      model: null,
      seconds: 0.2,
      extraction: scenario.expected,
    });
  });

  it("forces the seventh, unscored demo through Azure", async () => {
    const scenario = voiceScenario("complex")!;
    expect(scenario.expected).toBeNull();
    selectProvider.mockReturnValue({ name: "azure", model: "test", extract });
    extract.mockResolvedValue({
      payload: { version: "1.0", commitments: [] },
      model: "test",
      effort: "medium",
      usage: null,
      seconds: 0.2,
    });
    const response = await POST(request({ scenarioId: "complex" }));
    expect(response.status).toBe(200);
    expect(selectProvider).toHaveBeenCalledWith("azure");
    expect(extract).toHaveBeenCalledWith(scenario.transcript);
    expect((await response.json()).provider).toBe("azure");
  });

  it("does not expose invalid model output", async () => {
    extract.mockResolvedValue({
      payload: { private: "bad answer" },
      model: "test",
      effort: "medium",
      usage: null,
      seconds: 0.2,
    });
    const response = await POST(request({ scenarioId: "clear" }));
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain("private");
    expect(body).not.toContain("bad answer");
  });

  it("reports the shared-key daily ceiling without making a second call", async () => {
    extract.mockRejectedValue(new SchoolKeyExhausted(10));
    const response = await POST(request({ scenarioId: "clear" }));
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("too_many_requests");
  });
});
