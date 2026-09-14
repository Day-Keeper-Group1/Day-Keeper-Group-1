import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/server/auth/session";
import { getDocument } from "@/server/documents";

/**
 * The upload day as this screen writes it: '10 Aug'.
 *
 * `uploadedAt` is an instant rather than a calendar day, so this is the one
 * date on the screen that src/lib/contract/dates.ts cannot write: its
 * formatters take 'YYYY-MM-DD'. The person's own zone is passed in rather than
 * left to the default, because this renders on the server, and the server's
 * idea of the day is not hers. See src/lib/contract/dates.ts on why a day off
 * by one is the worst bug this product has available to it.
 */
function formatUploadedDay(uploadedAt: string, timeZone: string): string {
  return new Date(uploadedAt).toLocaleDateString("en-AU", {
    timeZone,
    day: "numeric",
    month: "short",
  });
}

/**
 * One letter, opened from the letters area.
 *
 * A server component, so the reading is fetched by calling the same module the
 * endpoint calls rather than by going back out through HTTP to our own API.
 * The (app) layout has already required a session, so requireUser() here is
 * asking who it is rather than whether there is anybody.
 */
export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const document = await getDocument(id, user.id, user.timeZone);
  // A letter belonging to somebody else is absent, not forbidden: see
  // docs/api.md on why this is a 404 and never a 403.
  if (!document) notFound();

  const needsReview = document.status === "needs-review";
  // Rows the model was not confident of never carry a value, and a row with no
  // value is not drawn at all. The reasoning is in src/lib/contract/api.ts.
  const readable = document.fields.filter(
    (field) => field.status === "confirmed" && field.value,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={document.label}
        actions={
          needsReview ? (
            <Button
              render={
                <Link href={`/documents/${document.id}/review`}>
                  Review extracted information
                </Link>
              }
            />
          ) : undefined
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:order-2">
          {document.pages.length === 0 ? (
            <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
              <p className="px-6 text-center text-sm text-muted-foreground">
                The photographs of this letter are not available.
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {document.pages.map((page) =>
                page.url ? (
                  <li key={page.id}>
                    {/* A letter may run to ten pages, of which she sees the
                        first before scrolling, so the rest are fetched when
                        they are wanted. That also means storage signs each
                        link at the moment the image is asked for, rather than
                        signing ten at once and racing her scroll. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.url}
                      alt={`Page ${page.pageNumber}`}
                      loading="lazy"
                      className="w-full max-w-full rounded-lg border border-border"
                    />
                  </li>
                ) : null,
              )}
            </ol>
          )}
        </div>

        <div className="space-y-6 md:order-1">
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">Status</h2>
              <StatusBadge status={document.status} />
            </div>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Uploaded</dt>
              <dd className="text-right text-foreground">
                {formatUploadedDay(document.uploadedAt, user.timeZone)}
              </dd>
              {readable.map((field) => (
                <Fragment key={field.key}>
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="text-right text-foreground">{field.value}</dd>
                </Fragment>
              ))}
            </dl>
          </section>

          {document.failure ? (
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
              {document.failure.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
