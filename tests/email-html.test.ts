import { describe, expect, it } from "vitest";
import { sanitizeEmailHtml } from "@/server/email/html";
import { parseGmailMessage } from "@/server/email/gmail/provider";
import { emailPreviewDocument } from "@/lib/email-preview";

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
  it.each([
    "HTML_QuarterlyBillHeader.jpg",
    "Bill_HTML_Button_PayNow.jpg",
    "Bill_HTML_Button_Account.jpg",
    "BPAY.png",
  ])(
    "uses the current HTTPS location for Yarra Valley artwork %s",
    (filename) => {
      const source = `http://www.yvw.com.au/yvw/groups/public/documents/images/${filename}`;
      const clean = sanitizeEmailHtml(
        `<a href="https://www.yvw.com.au/paynow"><img src="${source}"></a>`,
      );
      expect(clean).toContain(
        `data-email-src="https://comms.yvw.com.au/comms/OLD/${filename}"`,
      );
      expect(clean).toContain('href="https://www.yvw.com.au/paynow"');
      expect(emailPreviewDocument(clean)).not.toMatch(/\ssrc=/);
      expect(emailPreviewDocument(clean, {}, true)).toContain(
        `src="https://comms.yvw.com.au/comms/OLD/${filename}"`,
      );
    },
  );

  it("does not rewrite unrelated or signed image addresses as Yarra Valley artwork", () => {
    for (const url of [
      "https://www.yvw.com.au.example.org/yvw/groups/public/documents/images/header.jpg",
      "https://www.yvw.com.au/yvw/groups/public/documents/images/header.jpg?token=example",
      "https://www.yvw.com.au/other/header.jpg",
    ])
      expect(sanitizeEmailHtml(`<img src="${url}">`)).not.toContain(
        "comms.yvw.com.au",
      );
  });
  it.each([
    ["http://images.example/bill.png", "http://images.example/bill.png"],
    ["//images.example/bill.png", "https://images.example/bill.png"],
    [
      "https://images.example/bill.png?a=1&b=2",
      "https://images.example/bill.png?a=1&amp;b=2",
    ],
  ])(
    "preserves external image URL %s until images are enabled",
    (input, expected) => {
      const clean = sanitizeEmailHtml(`<img src="${input}" alt="Bill logo">`);
      expect(clean).toContain(`data-email-src="${expected}"`);
      expect(emailPreviewDocument(clean)).not.toMatch(/\ssrc=/);
      expect(emailPreviewDocument(clean, {}, true)).toContain(
        `src="${expected}"`,
      );
    },
  );
  it("keeps embedded stylesheets, responsive rules and matching classes", () => {
    const html =
      '<html><head><style>.bill{width:640px;background:#fff}.amount{font-size:24px}@media(max-width:500px){.bill{width:100%}}</style><link rel="stylesheet" href="https://example.com/css"></head><body><table class="bill"><tr><td class="amount">$10.72</td></tr></table></body></html>';
    const clean = sanitizeEmailHtml(html);
    expect(clean).toContain("<style>.bill");
    expect(clean).toContain("@media(max-width:500px)");
    expect(clean).toContain('class="bill"');
    expect(clean).toContain('class="amount"');
    expect(clean).not.toContain("<link");
    expect(emailPreviewDocument(clean)).not.toContain(
      "height: auto !important",
    );
  });

  it("prevents sender metadata from overriding preview restrictions", () => {
    const clean = sanitizeEmailHtml(
      '<meta http-equiv="Content-Security-Policy" content="default-src *"><base href="https://example.com"><style>@import "https://example.com/css";</style><form action="https://example.com"><input></form>',
    );
    expect(clean).not.toMatch(/<meta|<base|<form|<input/);
    const preview = emailPreviewDocument(clean);
    expect(preview).toContain("style-src 'unsafe-inline';");
    expect(preview).toContain("base-uri 'none'; form-action 'none'");
  });
  it("preserves emphasis, lists, tables and Gmail inline formatting", () => {
    const html =
      '<p><strong>Bold</strong> <em>Italic</em> <u>Underlined</u></p><ul><li>First</li></ul><table><tr><td>Amount</td></tr></table><span style="font-weight:700;font-style:italic;text-decoration:underline">Styled</span>';
    const parsed = parseGmailMessage(message(html));
    expect(parsed?.textBody).toBe("Plain fallback");
    expect(parsed?.sanitizedHtmlBody).toBe(html);
  });

  it("removes executable markup while retaining sender CSS for the isolated preview", () => {
    const html =
      '<div id="app" class="overlay" onclick="alert(1)" style="position:fixed;background:url(https://tracker.example);color:white;font-weight:bold">Keep<img src="https://tracker.example/pixel" onerror="alert(1)"><script>alert(1)</script><style>body{display:none}</style><iframe src="https://tracker.example">Hidden</iframe><svg><a href="javascript:alert(1)">SVG</a></svg><form action="https://tracker.example"><input autofocus></form></div>';
    const clean = sanitizeEmailHtml(html);
    expect(clean).not.toMatch(/<script|<iframe|<svg|<input|onclick=|onerror=/);
    expect(clean).toContain('class="overlay"');
    expect(clean).toContain("<style>body{display:none}</style>");
    expect(emailPreviewDocument(clean)).toContain("img-src data:;");
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

  it("preserves a bill's coloured table cells and rounded action links", () => {
    const clean = sanitizeEmailHtml(
      '<table width="650" cellpadding="0" cellspacing="0"><tr><td style="background-color:#0033dd;padding:12px;text-align:center;color:white">Amount due <b>$10.72</b></td><td><a href="https://example.com/pay" style="display:inline-block;background-color:#008844;color:white;border-radius:24px;padding:12px 24px">Pay now</a></td></tr></table>',
    );
    expect(clean).toContain('width="650"');
    expect(clean).toContain("background-color:#0033dd;padding:12px");
    expect(clean).toContain("border-radius:24px");
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it("keeps image resources inert until explicitly activated", () => {
    const html = sanitizeEmailHtml(
      '<img src="https://example.com/logo.png" srcset="https://tracker.example/pixel 2x"><img src="cid:logo@example"><img src="data:image/svg+xml,attack"><img src="/api/private"><img data-email-src="https://forged.example">',
    );
    expect(html).not.toMatch(/\ssrc=/);
    expect(html).not.toContain("srcset");
    expect(html).not.toContain("forged.example");
    expect(emailPreviewDocument(html)).not.toMatch(/\ssrc=/);
    const shown = emailPreviewDocument(
      html,
      { "logo%40example": "data:image/png;base64,iVBORw==" },
      true,
    );
    expect(shown).toContain('src="https://example.com/logo.png"');
    expect(shown).toContain('src="data:image/png;base64,iVBORw=="');
    expect(shown).toContain("script-src 'none'");
    expect(shown).toContain("connect-src 'none'");
  });

  it("preserves sender CSS but blocks its resource loads through the preview CSP", () => {
    const clean = sanitizeEmailHtml(
      '<div style="position:fixed;z-index:9999;background-image:url(https://tracker.example);width:expression(alert(1));font-family:Arial,sans-serif;border:1px solid #123456">Text</div>',
    );
    expect(clean).toContain("tracker");
    expect(emailPreviewDocument(clean)).toContain("script-src 'none'");
    expect(clean).toContain("position:fixed");
    expect(emailPreviewDocument(clean)).toContain("img-src data:;");
    expect(emailPreviewDocument(clean, {}, true)).toContain(
      "img-src data: https: http:;",
    );
    expect(clean).toContain("font-family:Arial,sans-serif");
    expect(clean).toContain("border:1px solid #123456");
  });
});
