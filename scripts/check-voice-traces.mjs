/** Keep browser speech libraries out of deployed server functions. */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const serverRoot = resolve(".next/server");
const prompt = "src/server/voice/prompt.md";
const promptRoutes = [
  "app/api/conversations/route.js.nft.json",
  "app/api/conversations/extract/route.js.nft.json",
];

function traceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return traceFiles(path);
    return entry.name.endsWith(".nft.json") ? [path] : [];
  });
}

const traces = traceFiles(serverRoot);
if (traces.length === 0)
  throw new Error("No Next.js server traces were built.");

for (const path of traces) {
  const files = JSON.parse(readFileSync(path, "utf8")).files;
  if (
    files.some((file) =>
      /(?:^|\/)(?:onnxruntime-(?:node|web)|@huggingface\/transformers)(?:\/|$)/.test(
        file.replaceAll("\\", "/"),
      ),
    )
  ) {
    throw new Error(
      `Browser speech dependencies entered the server trace: ${path}`,
    );
  }
}

for (const route of promptRoutes) {
  const files = JSON.parse(readFileSync(join(serverRoot, route), "utf8")).files;
  if (!files.some((file) => file.replaceAll("\\", "/").endsWith(prompt))) {
    throw new Error(`Voice prompt is missing from the server trace: ${route}`);
  }
}
