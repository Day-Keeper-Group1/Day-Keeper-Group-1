"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import {
  EMAIL_FAILURE_MESSAGES,
  type DocumentDetail,
  type DocumentSummary,
} from "@/lib/contract/api";

export function ReadingStatus({ document }: { document: DocumentSummary }) {
  const router = useRouter();
  const [failed, setFailed] = useState(document.status === "failed");
  const [problem, setProblem] = useState("");
  const [failureMessage, setFailureMessage] = useState(
    document.failure?.message ?? EMAIL_FAILURE_MESSAGES.other,
  );
  useEffect(() => {
    if (failed) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/api/documents/${document.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 401) {
            router.replace("/login");
            return;
          }
          if (response.status === 404) {
            setProblem("This reading is no longer available.");
            return;
          }
          throw new Error("Could not check the reading. Retrying...");
        }
        const current: DocumentDetail = await response.json();
        if (controller.signal.aborted) return;
        setProblem("");
        if (current.status === "needs-review") {
          router.replace(`/documents/${document.id}/review`);
          return;
        }
        if (current.status === "confirmed" || current.status === "archived") {
          router.replace(`/documents/${document.id}`);
          return;
        }
        if (current.status === "failed") {
          if (current.correction) {
            router.replace(`/documents/${document.id}/review`);
            return;
          }
          setFailureMessage(
            current.failure?.message ?? EMAIL_FAILURE_MESSAGES.other,
          );
          setFailed(true);
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        setProblem("Could not check the reading. Retrying...");
      }
      if (!controller.signal.aborted)
        timer = setTimeout(() => void poll(), 2000);
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [document.id, failed, router]);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ScreenHeader
        title={failed ? "Could not read this email" : "Reading your email"}
        subtitle={document.label}
      />
      <Panel>
        <p role="status" className="text-row leading-relaxed">
          {failed
            ? failureMessage
            : "We are reading the six key fields. The review page will open when they are ready. No task has been saved yet."}
        </p>
        {problem && (
          <p role="alert" className="mt-3 text-warn">
            {problem}
          </p>
        )}
        <Button
          className="mt-5"
          variant="outline"
          nativeButton={false}
          render={<Link href="/email">Back to inbox</Link>}
        />
      </Panel>
    </div>
  );
}
