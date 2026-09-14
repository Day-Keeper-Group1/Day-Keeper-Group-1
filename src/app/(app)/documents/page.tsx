"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FolderOpen, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DocumentStatus, DocumentSummary } from "@/lib/contract/api";
import { formatDueDate } from "@/lib/contract/dates";

const FILTERS: { label: string; value: "all" | DocumentStatus }[] = [
  { label: "All", value: "all" },
  { label: "Needs review", value: "needs-review" },
  { label: "Processing", value: "processing" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Failed", value: "failed" },
  { label: "Archived", value: "archived" },
];

/**
 * How often the list asks again while a letter is still being read.
 *
 * A reading takes about ten seconds (AGENTS.md), so five seconds is short
 * enough that a row stops saying "Processing" while the person is still
 * looking at it. The polling stops the moment no row is processing, so an
 * idle letters area makes no requests at all.
 */
const POLL_INTERVAL_MS = 5000;

/**
 * The upload day as a list column writes it: '10 Aug'.
 *
 * `uploadedAt` is an instant rather than a calendar day, so this is the one
 * date on the screen that src/lib/contract/dates.ts cannot write: its
 * formatters take 'YYYY-MM-DD', and turning an instant into the person's day is
 * server work (the label the server resolves does exactly that). Here the
 * browser's own zone is the right answer, because the browser is where she is.
 */
function formatUploadedDay(uploadedAt: string): string {
  return new Date(uploadedAt).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

export default function DocumentArchivePage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | DocumentStatus>("all");
  const [letters, setLetters] = useState<DocumentSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // The list refreshes itself only while there is something to wait for, so the
  // effect is keyed on that fact rather than on the letters themselves: a
  // refresh that changes nothing leaves the timer where it is.
  const anyProcessing = (letters ?? []).some(
    (letter) => letter.status === "processing",
  );

  useEffect(() => {
    // A request still in flight when the person navigates away must not write
    // state into a screen that has gone, and neither must one that the next run
    // of this effect has already replaced.
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/documents");
        if (cancelled) return;
        if (!response.ok) {
          setLoadFailed(true);
          return;
        }
        const body = (await response.json()) as DocumentSummary[];
        if (cancelled) return;
        setLetters(body);
        setLoadFailed(false);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    }

    void load();
    if (!anyProcessing) {
      return () => {
        cancelled = true;
      };
    }

    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [anyProcessing]);

  const documents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (letters ?? []).filter((doc) => {
      const matchesFilter = filter === "all" || doc.status === filter;
      const matchesQuery =
        needle.length === 0 || doc.label.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [letters, query, filter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Everything you've uploaded, in one place."
      />

      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <Input
            type="search"
            placeholder="Search by issuer or type"
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as "all" | DocumentStatus)}
        >
          <TabsList className="flex-wrap">
            {FILTERS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loadFailed ? (
        <p className="text-sm text-foreground">
          We could not load your letters just now. Please try again in a moment.
        </p>
      ) : null}

      {letters === null ? (
        // Nothing has arrived yet. When it was the first request that failed,
        // the sentence above is the whole screen and there is no point saying
        // we are still loading something that has already stopped loading.
        loadFailed ? null : (
          <p className="text-sm text-muted-foreground">
            Loading your letters...
          </p>
        )
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents match"
          description="Try a different search term or filter."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Letter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/documents/${doc.id}`}
                        className="block font-medium text-foreground"
                      >
                        {doc.label}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.dueDate ? formatDueDate(doc.dueDate, "short") : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.pageCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatUploadedDay(doc.uploadedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-2 md:hidden">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/documents/${doc.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {doc.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}{" "}
                      &middot; {formatUploadedDay(doc.uploadedAt)}
                    </span>
                  </span>
                  <StatusBadge status={doc.status} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
