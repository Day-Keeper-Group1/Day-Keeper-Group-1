import "server-only";
import { emailPageSchema, type EmailProvider } from "./provider";

/** Explicit fixture pages make retries deterministic; this never contacts a mailbox. */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";
  private readonly pages;

  constructor(pages: unknown[]) {
    this.pages = pages.map((page) => emailPageSchema.parse(page));
  }

  async readPage(cursor: string | null): Promise<unknown> {
    const index =
      cursor === null
        ? 0
        : this.pages.findIndex((page) => page.nextCursor === cursor) + 1;
    if (cursor !== null && (index === 0 || index >= this.pages.length)) {
      throw new Error("Unknown mock email cursor");
    }
    return structuredClone(
      this.pages[index] ?? { messages: [], nextCursor: null },
    );
  }
}
