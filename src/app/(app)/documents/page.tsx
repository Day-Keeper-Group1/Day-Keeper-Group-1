"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FolderOpen, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge, type Status } from "@/components/status-badge";
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
import type { DocumentSummary } from "@/lib/contract/api";

const FILTERS: { label: string; value: "all" | Status }[] = [
  { label: "All", value: "all" },
  { label: "Needs review", value: "needs-review" },
  { label: "Processing", value: "processing" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Failed", value: "failed" },
  { label: "Archived", value: "archived" },
];

/** The browser owns display timezone; the API keeps the unambiguous UTC instant. */
function formatUploadedAt(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return instant;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export default function DocumentArchivePage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDocuments() {
      try {
        const response = await fetch("/api/documents", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(
            body.error?.message ?? "We could not load your documents.",
          );
        }
        if (active) setDocuments(body);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "We could not load your documents.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDocuments();
    return () => {
      active = false;
    };
  }, []);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesFilter = filter === "all" || doc.status === filter;
      const matchesQuery =
        query.trim().length === 0 ||
        `${doc.label} ${doc.issuer ?? ""} ${doc.documentType ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [documents, query, filter]);

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
          onValueChange={(value) => setFilter(value as "all" | Status)}
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

      {loading ? (
        <p className="text-sm text-muted-foreground">
          Loading your documents...
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : filteredDocuments.length === 0 ? (
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
                  <TableHead>Issuer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={
                          doc.status === "needs-review"
                            ? `/documents/${doc.id}/review`
                            : `/documents/${doc.id}`
                        }
                        className="block font-medium text-foreground"
                      >
                        {doc.label}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.documentType ?? "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.dueDate ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatUploadedAt(doc.uploadedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-2 md:hidden">
            {filteredDocuments.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={
                    doc.status === "needs-review"
                      ? `/documents/${doc.id}/review`
                      : `/documents/${doc.id}`
                  }
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {doc.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {doc.documentType ?? "Reading"} &middot;{" "}
                      {formatUploadedAt(doc.uploadedAt)}
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
