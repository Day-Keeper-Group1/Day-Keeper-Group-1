import "server-only";
import sanitizeHtml from "sanitize-html";

/** Render ONLY inside the opaque-origin, CSP-restricted email iframe.
 * Sender CSS is preserved and must never be inserted into the application DOM. */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "div",
      "span",
      "br",
      "hr",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "s",
      "blockquote",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "pre",
      "code",
      "sub",
      "sup",
      "a",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "caption",
      "img",
      "center",
      "style",
      "font",
      "colgroup",
      "col",
    ],
    allowedAttributes: {
      "*": [
        "style",
        "class",
        "id",
        "dir",
        "lang",
        "align",
        "valign",
        "width",
        "height",
        "bgcolor",
        "background",
      ],
      font: ["color", "face", "size"],
      col: ["span"],
      style: ["type", "media"],
      a: ["href", "title", "target", "rel"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      ol: ["start"],
      table: ["cellpadding", "cellspacing", "border", "role"],
      img: ["alt", "title", "data-email-src", "data-email-cid"],
    },
    // CSS stays inside an opaque sandbox. CSP blocks CSS imports, fonts, and
    // external images until the reader explicitly enables images.
    allowVulnerableTags: true,
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src", "cite", "background"],
    allowProtocolRelative: false,
    nonTextTags: [
      "script",
      "textarea",
      "option",
      "iframe",
      "object",
      "svg",
      "math",
      "template",
      "title",
    ],
    transformTags: {
      body: "div",
      img: (_tag, attributes) => {
        // Some senders use scheme-relative or HTTP image links. Do not silently
        // discard those before the reader has a chance to enable images.
        const raw = attributes.src?.trim() ?? "";
        const src = raw.startsWith("//") ? `https:${raw}` : raw;
        const attribs: Record<string, string> = {};
        for (const key of [
          "alt",
          "title",
          "width",
          "height",
          "style",
          "align",
          "class",
          "id",
        ]) {
          if (attributes[key]) attribs[key] = attributes[key];
        }
        if (/^https?:\/\//i.test(src)) {
          try {
            const url = new URL(src);
            // Older Yarra Valley bills reference a retired HTTP asset directory.
            // Its public images permanently redirect to this HTTPS archive.
            // Rewrite only simple static image paths, never bill/payment links.
            const legacyArtwork = url.pathname.match(
              /^\/yvw\/groups\/public\/documents\/images\/([A-Za-z0-9_-]+\.(?:jpg|jpeg|png|gif))$/i,
            );
            if (
              url.hostname === "www.yvw.com.au" &&
              !url.port &&
              !url.search &&
              !url.hash &&
              legacyArtwork
            ) {
              url.protocol = "https:";
              url.hostname = "comms.yvw.com.au";
              url.pathname = `/comms/OLD/${legacyArtwork[1]}`;
            }
            if (!url.username && !url.password)
              attribs["data-email-src"] = url.href;
          } catch {
            /* Invalid URLs remain placeholders. */
          }
        } else if (/^cid:.{1,500}$/i.test(src)) {
          try {
            attribs["data-email-cid"] = encodeURIComponent(
              decodeURIComponent(src.slice(4)).replace(/^<|>$/g, ""),
            );
          } catch {
            /* Invalid CID stays a placeholder. */
          }
        }
        return { tagName: "img", attribs };
      },
      a: (_tag, attributes) => {
        // Relative links must never become links to DayKeeper's own routes.
        const href = attributes.href?.trim();
        return {
          tagName: "a",
          attribs: {
            ...(attributes.style ? { style: attributes.style } : {}),
            ...(attributes.class ? { class: attributes.class } : {}),
            ...(attributes.id ? { id: attributes.id } : {}),
            ...(href && /^(?:https?:\/\/|mailto:)/i.test(href) ? { href } : {}),
            ...(attributes.title ? { title: attributes.title } : {}),
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
    },
  }).trim();
}
