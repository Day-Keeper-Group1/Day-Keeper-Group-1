"use client";

import { useEffect, useRef, useState } from "react";
import type { EmailMessage } from "@/lib/contract/email";
import { emailPreviewDocument } from "@/lib/email-preview";

/** Original sender HTML is isolated from the app; images load when opened. */
export function EmailBody({ message }: { message: EmailMessage }) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [imageError, setImageError] = useState("");
  const stopSizing = useRef<(() => void) | null>(null);
  useEffect(() => () => stopSizing.current?.(), []);

  function fitEmail(frame: HTMLIFrameElement) {
    stopSizing.current?.();
    const body = frame.contentDocument?.getElementById(
      "daykeeper-email-content",
    );
    if (!body) return;
    let pending = 0;
    const resize = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        const availableWidth = frame.clientWidth;
        if (!availableWidth) return;
        // Keep the sender's desktop layout intact, as Gmail does, and fit the
        // entire email to the phone rather than rearranging its nested tables.
        body.style.width = `${Math.max(640, availableWidth)}px`;
        const layoutWidth = Math.max(body.scrollWidth, 640, availableWidth);
        body.style.width = `${layoutWidth}px`;
        const scale = Math.min(1, availableWidth / layoutWidth);
        body.style.transform = `scale(${scale})`;
        const height = Math.ceil(body.scrollHeight * scale) + 2;
        if (frame.style.height !== `${height}px`)
          frame.style.height = `${height}px`;
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(body);
    observer.observe(frame);
    // Image loads can change the content height after the initial layout.
    body.addEventListener("load", resize, true);
    resize();
    stopSizing.current = () => {
      observer.disconnect();
      body.removeEventListener("load", resize, true);
      cancelAnimationFrame(pending);
    };
  }

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
          // Same-origin access lets the parent measure content; scripts remain
          // forbidden by both the sandbox and the preview's CSP.
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          onLoad={(event) => fitEmail(event.currentTarget)}
          referrerPolicy="no-referrer"
          className="block min-h-96 w-full rounded-md border border-line bg-card"
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
