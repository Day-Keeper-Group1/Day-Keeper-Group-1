"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { MAX_PAGES } from "@/lib/contract/api";

type Photo = {
  id: string;
  file: File;
  previewUrl: string | null;
};

/**
 * An upload is one letter. It may run to several pages, so the camera stays
 * open across taps and the pages grow as a grid rather than replacing each
 * other, but every photograph in an upload belongs to the same letter. Which
 * letter a page belongs to is settled here, by the person, rather than
 * inferred later by a model. See docs/scope.md.
 *
 * ⚠️ The screen below has not caught up: its copy still offers to sort a pile
 * of mixed letters, which this release does not do. That is a separate ticket,
 * because changing it changes what a person sees rather than what a document
 * says.
 */
export default function UploadDocumentPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  function handleSubmit() {
    if (photos.length === 0) return;
    setSubmitting(true);
    // No backend yet (see AGENTS.md: the API and the pages are the work
    // still to build), so this is where a real POST /api/documents would
    // go. The mock flow moves straight to the archive, where the batch
    // would appear as it divides into letters.
    router.push("/documents");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Take photos"
        description="A letter, a bill, a doctor's note: anything with a date in it. They don't have to be the same letter."
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
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
        <span className="text-sm font-medium text-foreground">
          {atLimit ? "That's ten, the most in one go" : "Tap to photograph"}
        </span>
        <span className="text-xs text-muted-foreground">
          the camera stays open, keep going
        </span>
      </button>

      {photos.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Your pile &middot; {photos.length}{" "}
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
                    alt={`Photo ${index + 1} of the pile`}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
                    photo {index + 1}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  aria-label={`Remove photo ${index + 1}`}
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                >
                  <X className="size-3.5" strokeWidth={2} />
                </button>
              </div>
            ))}
            {!atLimit ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs font-medium text-primary hover:bg-muted/40"
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
          onClick={handleSubmit}
        >
          <Upload className="size-4" strokeWidth={1.75} />
          {photos.length > 1 ? "Read them" : "Read it"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Photograph the whole pile. We work out where one letter ends and the
          next begins, so you don&apos;t have to sort them first. Up to{" "}
          {MAX_PAGES} photos in one go.
        </p>
      </div>
    </div>
  );
}
