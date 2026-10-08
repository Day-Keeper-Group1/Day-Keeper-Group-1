/** Input must come from sanitizeEmailHtml; this is not an HTML sanitizer. */
export function emailPreviewDocument(
  html: string,
  images: Record<string, string> = {},
  externalImages = false,
) {
  const body = html.replace(/<img\b[^>]*>/g, (tag) => {
    const cid = tag.match(/data-email-cid="([^"]*)"/)?.[1];
    const image = cid ? images[cid] : undefined;
    // Only validated raster data may be substituted into the sandbox document.
    if (
      image &&
      /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
    ) {
      return tag.replace(/data-email-cid="[^"]*"/, `src="${image}"`);
    }
    if (externalImages)
      return tag.replace(
        'data-email-src="',
        'referrerpolicy="no-referrer" src="',
      );
    return tag;
  });
  const policy = `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:${externalImages ? " https: http:" : ""}; base-uri 'none'; form-action 'none'; font-src 'none'; connect-src 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html { color-scheme: light; overflow: hidden; }
    body { display: flow-root; overflow: hidden; margin: 0; color: #222; background: #fff; font: 14px/normal Arial, sans-serif; overflow-wrap: break-word; }
    img { max-width: 100%; }
    img:not([src]) { display: inline-block; }
    pre { white-space: pre-wrap; }
    a { overflow-wrap: anywhere; }
    #daykeeper-email-content { display: flow-root; transform-origin: top left; }
  </style></head><body><div id="daykeeper-email-content">${body}</div></body></html>`;
}
