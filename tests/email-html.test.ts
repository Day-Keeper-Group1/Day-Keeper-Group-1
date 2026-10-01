import { describe, expect, it } from "vitest";
import { sanitizeEmailHtml } from "@/server/email/html";
import { parseGmailMessage } from "@/server/email/gmail/provider";

const message = (html: string, text = "Plain fallback") => ({
  id: "formatted-email",
  internalDate: "1790208000000",
  payload: {
    mimeType: "multipart/alternative",
    headers: [{ name: "From", value: "sender@example.com" }],
    parts: [
      {
        mimeType: "text/plain",
        body: { data: Buffer.from(text).toString("base64url") },
      },
      {
        mimeType: "text/html",
        body: { data: Buffer.from(html).toString("base64url") },
      },
    ],
  },
});

describe("formatted email boundary", () => {
  it("preserves emphasis, lists, tables and Gmail inline formatting", () => {
    const html =
      '<p><strong>Bold</strong> <em>Italic</em> <u>Underlined</u></p><ul><li>First</li></ul><table><tr><td>Amount</td></tr></table><span style="font-weight:700;font-style:italic;text-decoration:underline">Styled</span>';
    const parsed = parseGmailMessage(message(html));
    expect(parsed?.textBody).toBe("Plain fallback");
    expect(parsed?.sanitizedHtmlBody).toBe(html);
  });

  it("removes executable markup, tracking resources and styles that escape the message", () => {
    const html =
      '<div id="app" class="overlay" onclick="alert(1)" style="position:fixed;background:url(https://tracker.example);color:white;font-weight:bold">Keep<img src="https://tracker.example/pixel" onerror="alert(1)"><script>alert(1)</script><style>body{display:none}</style><iframe src="https://tracker.example">Hidden</iframe><svg><a href="javascript:alert(1)">SVG</a></svg><form action="https://tracker.example"><input autofocus></form></div>';
    expect(sanitizeEmailHtml(html)).toBe(
      '<div style="font-weight:bold">Keep</div>',
    );
  });

  it.each([
    "javascript:alert(1)",
    "jav&#x61;script:alert(1)",
    "data:text/html,attack",
    "//tracker.example",
    "/api/auth/logout",
    "#app",
  ])("removes unsafe or application-relative link %s", (href) => {
    const clean = sanitizeEmailHtml(
      `<a href="${href}" ping="https://tracker.example">Link</a>`,
    );
    expect(clean).not.toContain("href=");
    expect(clean).not.toContain("ping=");
    expect(clean).toContain(">Link</a>");
  });

  it("opens safe links without opener access or a referrer", () => {
    expect(
      sanitizeEmailHtml(
        '<a href="https://example.com" target="_self">Visit</a>',
      ),
    ).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Visit</a>',
    );
  });

  it("falls back to plain text for empty, unsafe-only or oversized HTML", () => {
    for (const html of ["", "<script>attack()</script>", "x".repeat(100_001)]) {
      const parsed = parseGmailMessage(message(html));
      expect(parsed?.textBody).toBe("Plain fallback");
      expect(parsed?.sanitizedHtmlBody).toBeUndefined();
    }
  });

  it("does not display HTML attachments", () => {
    const raw = message("<b>Visible</b>");
    Object.assign(raw.payload.parts[1], { filename: "attachment.html" });
    expect(parseGmailMessage(raw)?.sanitizedHtmlBody).toBeUndefined();
  });
});
