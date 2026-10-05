"use client";

import { useEffect, useState } from "react";
import type { EmailMessage } from "@/lib/contract/email";
import { emailPreviewDocument } from "@/lib/email-preview";

/** Original sender HTML is isolated from the app; images load when opened. */
export function EmailBody({ message }: { message: EmailMessage }) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [imageError, setImageError] = useState("");
  const html = message.sanitizedHtmlBody;
  const hasEmbedded = !!html?.includes("data-email-cid=");
  useEffect(() => {
    if (!hasEmbedded) return;
    const controller = new AbortController();
    async function loadImages() {
      try {
        const response = await fetch("/api/email/gmail/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: message.providerMessageId }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Images unavailable");
        const result = await response.json();
        if (!controller.signal.aborted) {
          setImages(result.images);
          if (result.skipped)
            setImageError("Some embedded images could not be displayed.");
        }
      } catch {
        if (!controller.signal.aborted)
          setImageError(
            "Embedded images could not be loaded. You can still read the email text.",
          );
      }
    }
    void loadImages();
    return () => controller.abort();
  }, [hasEmbedded, message.providerMessageId]);

  return (
    <div className="space-y-3">
      {imageError && (
        <p role="status" className="text-sub text-ink-dim">
          {imageError}
        </p>
      )}
      {html ? (
        <iframe
          title={`Email: ${message.subject || "No subject"}`}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          className="h-[65vh] min-h-96 w-full rounded-md border border-line bg-card"
          srcDoc={emailPreviewDocument(html, images, true)}
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-row leading-relaxed">
          {message.textBody}
        </p>
      )}
    </div>
  );
}
