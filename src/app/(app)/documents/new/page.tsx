"use client";

import { useRef, useState } from "react";
import { Camera, CircleAlert, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InboxRow } from "@/components/inbox-row";
import { useActivity } from "@/components/layout/activity";
import { Panel, ScreenHeader } from "@/components/screen";
import {
  MAX_PAGES,
  type ApiError,
  type DocumentSummary,
} from "@/lib/contract/api";

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
   * Home shows under To check, first photographed first. The app asks for them
   * on arrival and every few seconds while any is being read
   * (src/components/layout/activity.tsx), so the row changes under her eyes
   * from "reading…" to a name. Null until the first answer arrives, so the
   * card is not drawn empty and then filled.
   */
  const { home, refresh } = useActivity();
  /** Letters sent from here that the last answer did not include yet. */
  const [sent, setSent] = useState<DocumentSummary[]>([]);
  const queue = home
    ? [
        ...home.inbox,
        ...sent.filter((doc) => !home.inbox.some((row) => row.id === doc.id)),
      ]
    : sent.length > 0
      ? sent
      : null;

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
      const letter = (await response.json()) as DocumentSummary;
      setPhotos((prev) => {
        for (const photo of prev) {
          if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
        }
        return [];
      });
      // At the end of the queue, because it was photographed last, and asked
      // for again at once so the app starts watching it being read.
      setSent((prev) => [...prev, letter]);
      void refresh();
    } catch {
      setError({
        message: "We could not reach the server. Please check your connection.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ScreenHeader
        title="Photograph your letter"
        subtitle="One letter at a time. If it runs to several pages, photograph every page."
      />

      {error ? (
        // An icon and a heading as well as the colour: theme.md's rule is that
        // colour is never the only thing carrying a message.
        <Alert variant="destructive" className="mb-3.5">
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

      {/* The prototype's `.cam`: a pale green, dashed area, green words. */}
      <button
        type="button"
        disabled={atLimit}
        onClick={() => inputRef.current?.click()}
        className="mb-3.5 flex w-full flex-col items-center rounded-[10px] border-2 border-dashed border-line bg-primary-soft px-4 py-[34px] text-center text-primary disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Camera className="mb-1.5 size-8" strokeWidth={1.75} />
        <span className="text-cam font-bold">
          {atLimit
            ? "That's ten pages, the most in one letter"
            : "Tap to photograph"}
        </span>
        <span className="mt-1 text-caption text-ink-dim">
          the camera stays open, keep going
        </span>
      </button>

      {photos.length > 0 ? (
        <Panel
          title={`This letter · ${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
          className="mb-3.5"
        >
          {/* `.pages`: 74 by 100 tiles, 10px apart, wrapping. */}
          <div className="flex flex-wrap gap-2.5">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative h-[100px] w-[74px] overflow-hidden rounded-[8px] border border-line bg-primary-soft"
              >
                {photo.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.previewUrl}
                    alt={`Photo ${index + 1} of this letter`}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-label text-ink-dim">
                    photo {index + 1}
                  </span>
                )}
                {/* Not in the prototype, whose camera cannot misfire. A real one
                    can, and a blurred page read as part of a letter is worse
                    than a small cross on its corner. */}
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  aria-label={`Remove photo ${index + 1}`}
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-card/90 text-foreground shadow-[var(--shadow-card)] after:absolute after:-inset-2"
                >
                  <X className="size-3.5" strokeWidth={2.25} />
                </button>
              </div>
            ))}
            {!atLimit ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-[100px] w-[74px] items-center justify-center rounded-[8px] border-2 border-dashed border-line bg-card text-label font-semibold text-primary"
              >
                + photo
              </button>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Button
        type="button"
        size="block"
        className="mt-1"
        disabled={photos.length === 0 || submitting}
        onClick={() => void handleSubmit()}
      >
        {submitting ? "Sending..." : "Read it"}
      </Button>
      <p className="mt-2.5 text-key leading-[1.45] text-ink-dim">
        Every photo you take here belongs to this one letter. They go together,
        and they are read as one.
      </p>

      {queue && queue.length > 0 ? (
        <Panel title="Sent to be read" className="mt-2">
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
