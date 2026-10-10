import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { emailCorrectionSchema } from "@/lib/contract/email-correction";
import {
  correctEmailReading,
  EmailCorrectionRefused,
} from "@/server/email/correction";
export const POST = route(
  async (request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return fail("not_found", "Letter not found.");
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return fail(
        "forbidden",
        "Open this page in DayKeeper to save corrections.",
      );
    const parsed = emailCorrectionSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return fail(
        "invalid_request",
        "Enter each highlighted field and a valid reading identifier.",
      );
    try {
      const result = await correctEmailReading(id, user.id, parsed.data);
      return result ? json(result) : fail("not_found", "Letter not found.");
    } catch (error) {
      if (error instanceof EmailCorrectionRefused)
        return fail("conflict", error.message);
      throw new Error("Email corrections could not be saved.");
    }
  },
);
