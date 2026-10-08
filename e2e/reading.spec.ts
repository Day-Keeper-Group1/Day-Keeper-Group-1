// KAN-98: a letter is read on the server, whether or not anybody's screen is open.

import path from "node:path";
import { expect, test } from "@playwright/test";
import type { DocumentDetail, DocumentSummary } from "@/lib/contract/api";

/**
 * The account this test uses. Same password convention as the seeded accounts,
 * whose password is public in the repository: this account holds nothing but
 * the letters this test uploads.
 */
const EMAIL = "e2e@example.com";
const PASSWORD = "daykeeper";

/**
 * The letter. Single page, and read the same way in every trial of experiments
 * 07, 08 and 09 under experiments/module-01-extraction/ (each one's
 * vote-output.md: the two readers agreed 20 times out of 20 and the judge was
 * never called), so on a deployed site it costs two model calls and does not
 * depend on luck. It is 657 KB, under the line where the page shrinks a photo
 * first (src/lib/photos.ts), so the file that goes up is this file. It lives in
 * Git LFS: CI fetches only it, with `git lfs pull --include` and this path.
 */
const LETTER = path.join(
  __dirname,
  "..",
  "data",
  "synthetic-letters",
  "05-animal-registration-overdue-notice",
  "page-01.png",
);

/** How long the reading may take. On the deployed site a round is 10 to 25 seconds. */
const READ_TIMEOUT_SECONDS = Number(
  process.env.E2E_READ_TIMEOUT_SECONDS ?? 240,
);
const POLL_SECONDS = 5;

test("a letter uploaded through the interface is read with nobody watching", async ({
  page,
  context,
}) => {
  // The waiting is most of this test, so its limit follows the reading's, with
  // two minutes on top for signing in and sending the photo.
  test.setTimeout((READ_TIMEOUT_SECONDS + 120) * 1000);

  // This is what makes "nobody watching" true. Every screen in the app asks
  // GET /api/home on arrival and every few seconds while a letter is being
  // read (src/components/layout/activity.tsx), and that request is what
  // carries an unfinished reading forward today (continueReadings in
  // src/server/uploads/reading.ts). Left alone, the camera screen itself would
  // ask it the moment the letter was sent, and a reader that never ran in the
  // background would still look as if it had. So for this whole test, no
  // screen gets an answer from it. The app treats a missing answer as nothing
  // new, so every screen still works.
  await context.route("**/api/home", (route) => route.abort());

  // Sign in through the real page. The first run on a fresh database has no
  // such account yet, and the login endpoint answers 401 for that, so then she
  // registers through the real registration page instead.
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  const [login] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/login"),
    ),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);

  if (login.status() === 401) {
    await page.goto("/register");
    await page.locator("#name").fill("End-to-end test");
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm-password").fill(PASSWORD);
    const [registered] = await Promise.all([
      page.waitForResponse((response) =>
        response.url().endsWith("/api/auth/register"),
      ),
      page.getByRole("button", { name: "Create account" }).click(),
    ]);
    expect(registered.status(), "registering the test account").toBe(201);
  } else {
    expect(login.status(), "signing in as the test account").toBe(200);
  }
  // Both pages go to Home once the session cookie is set.
  await page.waitForURL("**/dashboard");

  // Photograph a letter, the way she would: the camera screen, the photo, and
  // "Read it". The file input is hidden behind the big camera button; on a
  // phone tapping that button opens the camera, and handing the input a file
  // is what the camera would do.
  await page.goto("/documents/new");
  await page.locator('input[type="file"]').setInputFiles(LETTER);
  await expect(page.getByText("This letter · 1 photo")).toBeVisible();

  // The page sends the letter in three steps (docs/api.md, "Ask to upload a
  // letter"). The last, POST /api/documents, answers with the letter, at
  // 'processing', and starts the reading.
  const [created] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/documents",
    ),
    page.getByRole("button", { name: "Read it" }).click(),
  ]);
  expect(created.status(), "sending the letter").toBe(201);
  const letter = (await created.json()) as DocumentSummary;

  // Nobody is looking from here on.
  await page.close();

  // Ask about this one letter, and nothing else, every few seconds. The
  // request context shares the browser's cookies, so it is still her asking,
  // but it is not a screen: GET /api/documents/:id only reads.
  const deadline = Date.now() + READ_TIMEOUT_SECONDS * 1000;
  let current: DocumentDetail;
  for (;;) {
    const response = await context.request.get(`/api/documents/${letter.id}`);
    expect(response.status(), `looking up letter ${letter.id}`).toBe(200);
    current = (await response.json()) as DocumentDetail;
    if (current.status !== "processing" || Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_SECONDS * 1000));
  }

  // Still being read: nothing on the server carried the reading to its end.
  expect(
    current.status,
    `Letter ${letter.id} was not read within ${READ_TIMEOUT_SECONDS} seconds ` +
      `with nobody watching. This usually means the background reader did ` +
      `not run.`,
  ).not.toBe("processing");

  // Read, but the reader gave up on it. A different problem from the one
  // above: the reader ran. The person's sentence is all the API gives out;
  // the cause is in the extraction_runs and model_calls rows for this letter.
  expect(
    current.status,
    `Letter ${letter.id} was read and the reading failed ` +
      `("${current.failure?.message ?? ""}"). The reader ran; look at its ` +
      `extraction_runs and model_calls rows for why.`,
  ).not.toBe("failed");

  // Ready to check: src/lib/contract/enums.ts, DOCUMENT_STATUSES.
  expect(current.status).toBe("needs-review");
});
