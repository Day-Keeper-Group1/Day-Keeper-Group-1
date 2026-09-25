import { describe, expect, it, vi } from "vitest";
import { MockEmailProvider } from "@/server/email/mock-provider";
import { readEmail, readEmailPage } from "@/server/email/read";
import { readDemoMailbox } from "@/server/email/demo";

const message = {
  providerMessageId: "message-1",
  from: "appointments@example.com",
  subject: "Appointment reminder",
  receivedAt: "2026-09-09T09:00:00+10:00",
  textBody: "Your appointment is on 15 September at 10am.",
};

describe("email foundation", () => {
  it("validates the demo bill and appointment while keeping the newsletter non-actionable", async () => {
    const entries = await readDemoMailbox();
    expect(
      entries.map(({ message, reading }) => [
        message.providerMessageId,
        reading.kind,
      ]),
    ).toEqual([
      ["bill", "action"],
      ["appointment", "action"],
      ["newsletter", "no-action"],
    ]);
    const appointment = entries[1].reading;
    expect(appointment.kind).toBe("action");
    if (appointment.kind === "action") {
      expect(appointment.extraction.fields).toContainEqual({
        key: "due_time",
        value: "10:30",
        status: "confirmed",
      });
    }
    entries[0].message.subject = "Changed locally";
    expect((await readDemoMailbox())[0].message.subject).toBe(
      "Your Example Energy bill is ready",
    );
  });
  it("replays pages for retries and rejects an unknown cursor", async () => {
    const provider = new MockEmailProvider([
      { messages: [message], nextCursor: "page-2" },
      { messages: [], nextCursor: null },
    ]);
    expect(await readEmailPage(provider, null)).toEqual(
      await readEmailPage(provider, null),
    );
    expect(await readEmailPage(provider, "page-2")).toEqual({
      messages: [],
      nextCursor: null,
    });
    await expect(readEmailPage(provider, "unknown")).rejects.toThrow();
  });

  it("rejects invalid mailbox data before extraction", async () => {
    const extract = vi.fn();
    await expect(
      readEmail({ extract }, { ...message, receivedAt: "yesterday" }),
    ).rejects.toThrow();
    expect(extract).not.toHaveBeenCalled();
  });

  it("allows mail with no action without inventing a task", async () => {
    await expect(
      readEmail({ extract: async () => ({ kind: "no-action" }) }, message),
    ).resolves.toEqual({ kind: "no-action" });
  });

  it("rejects action extractions missing the existing six fields", async () => {
    await expect(
      readEmail(
        {
          extract: async () => ({ kind: "action", extraction: { fields: [] } }),
        },
        message,
      ),
    ).rejects.toThrow();
  });

  it("validates real adapters too", async () => {
    await expect(
      readEmailPage(
        { name: "invalid", readPage: async () => ({ messages: [message] }) },
        null,
      ),
    ).rejects.toThrow();
  });
});
