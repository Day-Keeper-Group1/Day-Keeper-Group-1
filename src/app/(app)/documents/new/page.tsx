"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export default function UploadDocumentPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFile(selected: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(selected && selected.type.startsWith("image/") ? URL.createObjectURL(selected) : null);
  }

  function handleSubmit() {
    if (!file) return;
    router.push("/documents");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Upload a document photo"
        description="Take a photo or choose a file of the letter, bill, or form."
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        className="sr-only"
        onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-16 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Camera className="size-6" strokeWidth={1.75} />
          </span>
          <span className="text-sm font-medium text-foreground">
            Tap to take a photo or choose a file
          </span>
          <span className="text-xs text-muted-foreground">
            JPG, PNG, or PDF, up to 10 MB
          </span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Preview of the uploaded document"
                className="max-h-80 w-full object-contain bg-muted"
              />
            ) : (
              <div className="flex items-center gap-3 px-4 py-6">
                <FileText className="size-6 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="truncate text-sm font-medium text-foreground">
                  {file.name}
                </span>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              handleFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <RotateCcw className="size-4" strokeWidth={1.75} />
            Retake or replace
          </Button>
        </div>
      )}

      <Button type="button" size="lg" className="w-full" disabled={!file} onClick={handleSubmit}>
        <Upload className="size-4" strokeWidth={1.75} />
        Submit for processing
      </Button>
    </div>
  );
}
