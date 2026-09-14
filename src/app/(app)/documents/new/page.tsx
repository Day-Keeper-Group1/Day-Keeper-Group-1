"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CircleAlert, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InboxRow } from "@/components/inbox-row";
import { Panel, ScreenHeader } from "@/components/screen";
import {
  MAX_PAGES,
  type ApiError,
  type DocumentSummary,
  type HomePayload,
} from "@/lib/contract/api";

/**
 * How often to ask again while a letter sent from here is still being read.
 * The same five seconds as Home, for the same reason (home-screen.tsx).
 */
const QUEUE_POLL_MS = 5000;

type Photo = {
  id: string;
  file: File;
  previewUrl: string | null;
};

/**
 * What went wrong, as the person is told it.
 *
 * The endpoint writes both sentences (docs/api.md), so they are shown as they
 * arrived rather than reworded here: `message` says what happened, and the
 * optional `pages` detail says which photograph caused it.
 */
type UploadError = {
  message: string;
  pages?: string;
};

/**
 * An upload is one letter. It may run to several pages, so the camera stays
 * open across taps and the pages grow as a grid rather than replacing each
 * other, but every photograph in an upload belongs to the same letter. Which
 * letter a page belongs to is settled here, by the person, rather than
 * inferred later by a model. See docs/scope.md. (KAN-28)
 */
export default function UploadDocumentPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);
  /**
   * Sent to be read: every letter of hers not yet dealt with, the same rows
   * Home shows under To check. Null until the first answer arrives, so the
   * card is not drawn empty and then filled.
   */
  const [queue, setQueue] = useState<DocumentSummary[] | null>(null);

  const reading = (queue ?? []).some((doc) => doc.status === "processing");

  // The queue is asked for once on arrival, so a letter sent a minute ago is
  // still here, and then every few seconds while any of it is being read,
  // so the row changes under her eyes from "reading…" to a name.
  useEffect(() => {
    let live = true;

    async function refresh() {
      try {
        const response = await fetch("/api/home", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as HomePayload;
        if (live) setQueue(payload.inbox);
      } catch {
        // A dropped poll is not worth a message; the next is seconds away.
      }
    }

    void refresh();
    const timer = reading
      ? window.setInterval(() => void refresh(), QUEUE_POLL_MS)
      : null;

    return () => {
      live = false;
      if (timer !== null) window.clearInterval(timer);
    };
  }, [reading]);

  const atLimit = photos.length >= MAX_PAGES;

  function addFile(selected: File | null) {
    if (!selected || atLimit) return;
    setPhotos((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        file: selected,
        previewUrl: selected.type.startsWith("image/")
          ? URL.createObjectURL(selected)
          : null,
      },
    ]);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleSubmit() {
    if (photos.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);

    // Every photograph goes under the same field name, in the order it was
    // taken, because one upload is one letter and the order they arrive is the
    // page order (docs/api.md). The Content-Type header is left alone on
    // purpose: the browser has to write it itself so that it carries the
    // multipart boundary.
    const form = new FormData();
    for (const photo of photos) form.append("pages", photo.file);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ApiError | null;
        setError({
          message:
            body?.error?.message ??
            "We could not save these photos just now. Please try again.",
          pages: body?.error?.fields?.pages,
        });
        return;
      }

      // The letter exists now and sits at 'processing' while the reading
      // runs. She stays here, as in the prototype: the camera clears for the
      // next letter and the one just sent appears below, first as "reading…"
      // and then, when the reading lands, under its own name with a way in.
      const sent = (await response.json()) as DocumentSummary;
      setPhotos((prev) => {
        for (const photo of prev) {
          if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
        }
        return [];
      });
      setQueue((prev) => [sent, ...(prev ?? [])]);
    } catch {
      setError({
        message: "We could not reach the server. Please check your connection.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ScreenHeader
        title="Photograph your letter"
        subtitle="One letter at a time. If it runs to several pages, photograph every page."
      />

      {error ? (
        // An icon and a heading as well as the colour: theme.md's rule is that
        // colour is never the only thing carrying a message.
        <Alert variant="destructive">
          <CircleAlert strokeWidth={1.75} />
          <AlertTitle>We could not save these photos</AlertTitle>
          <AlertDescription className="space-y-1">
            <span className="block">{error.message}</span>
            {error.pages ? <span className="block">{error.pages}</span> : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          addFile(event.target.files?.[0] ?? null);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      <button
        type="button"
        disabled={atLimit}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-10 text-center transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Camera className="size-6" strokeWidth={1.75} />
        </span>
        <span className="text-lg font-semibold text-foreground">
          {atLimit
            ? "That's ten pages, the most in one letter"
            : "Tap to photograph"}
        </span>
        <span className="text-base text-muted-foreground">
          the camera stays open, keep going
        </span>
      </button>

      {photos.length > 0 ? (
        <div className="space-y-3">
          <p className="text-base font-semibold text-foreground">
            This letter &middot; {photos.length}{" "}
            {photos.length === 1 ? "photo" : "photos"}
          </p>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-primary-soft"
              >
                {photo.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.previewUrl}
                    alt={`Photo ${index + 1} of this letter`}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-base text-muted-foreground">
                    photo {index + 1}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  aria-label={`Remove photo ${index + 1}`}
                  className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                >
                  <X className="size-4" strokeWidth={2} />
                </button>
              </div>
            ))}
            {!atLimit ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-base font-semibold text-primary hover:bg-muted/40"
              >
                <Camera className="size-4" strokeWidth={1.75} />+ photo
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={photos.length === 0 || submitting}
          onClick={() => void handleSubmit()}
        >
          <Upload className="size-4" strokeWidth={1.75} />
          {submitting ? "Sending..." : "Read it"}
        </Button>
        <p className="text-center text-base text-muted-foreground">
          Every photo you take here belongs to this one letter. They go
          together, and they are read as one. Up to {MAX_PAGES} pages.
        </p>
      </div>

      {queue && queue.length > 0 ? (
        <Panel title="Sent to be read">
          <ul>
            {queue.map((doc) => (
              <li
                key={doc.id}
                className="border-t border-line first:border-t-0"
              >
                <InboxRow doc={doc} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
