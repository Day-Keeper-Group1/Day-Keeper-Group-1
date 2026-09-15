import { describe, expect, it, vi } from "vitest";
import {
  CONTRACT_VERSION,
  parseExtractionResult,
} from "@/lib/contract/extraction";
import { OpenAIExtractionProvider } from "@/server/extraction/openai-provider";

const result = {
  contract_version: CONTRACT_VERSION,
  provider: "openai",
  model: "gpt-5.6-luna",
  fields: [
    {
      key: "document_type",
      value: "Utility bill",
      status: "confirmed",
      confidence: 0.99,
    },
    {
      key: "issuer",
      value: "Example Energy",
      status: "confirmed",
      confidence: 0.99,
    },
    {
      key: "action_required",
      value: "Pay the amount due",
      status: "confirmed",
      confidence: 0.99,
    },
    {
      key: "due_date",
      value: "2026-10-01",
      status: "confirmed",
      confidence: 0.99,
    },
    { key: "amount", value: "$50.00", status: "confirmed", confidence: 0.99 },
    { key: "reference", value: "12345", status: "confirmed", confidence: 0.99 },
  ],
  open_payload: {},
};

describe("OpenAIExtractionProvider", () => {
  it("sends photograph bytes to Responses and returns contract-shaped JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    document_type: result.fields[0],
                    issuer: result.fields[1],
                    action_required: result.fields[2],
                    due_date: result.fields[3],
                    amount: result.fields[4],
                    reference: result.fields[5],
                    open_payload: result.open_payload,
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new OpenAIExtractionProvider(
      {
        apiKey: "test-key",
        baseUrl: "https://example.test/v1/",
        model: "gpt-5.6-luna",
      },
      fetchFn,
    );

    const extracted = await provider.extract({
      documentId: "document-id",
      pages: [
        {
          pageNumber: 1,
          storagePath: "ignored-for-loaded-bytes.jpg",
          mimeType: "image/jpeg",
          bytes: Buffer.from([1, 2, 3]),
        },
      ],
    });

    expect(parseExtractionResult(extracted)).toEqual(result);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls[0][0]).toBe("https://example.test/v1/responses");
    const request = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(request.model).toBe("gpt-5.6-luna");
    expect(request.store).toBe(false);
    expect(request.input[0].content[1]).toMatchObject({
      type: "input_image",
      image_url: "data:image/jpeg;base64,AQID",
    });
  });
});
