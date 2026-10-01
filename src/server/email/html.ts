import "server-only";
import sanitizeHtml from "sanitize-html";

/** Email markup is untrusted. No resources, application classes or IDs survive. */
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
    ],
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "title", "target", "rel"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      ol: ["start"],
    },
    allowedStyles: {
      "*": {
        "font-weight": [/^(?:normal|bold|[1-9]00)$/],
        "font-style": [/^(?:normal|italic)$/],
        "text-decoration": [/^(?:none|underline|line-through)$/],
        "text-align": [/^(?:left|center|right)$/],
      },
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "iframe",
      "object",
      "svg",
      "math",
      "template",
    ],
    transformTags: {
      a: (_tag, attributes) => {
        // Relative links must never become links to DayKeeper's own routes.
        const href = attributes.href?.trim();
        return {
          tagName: "a",
          attribs: {
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
