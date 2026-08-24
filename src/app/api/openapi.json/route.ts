// KAN-29: the generated document itself, not wrapped in apiRoute since it is
// not part of the contract it describes.
import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/server/api/openapi";
import { routeDefinitions } from "@/server/api/registry";

export async function GET() {
  return NextResponse.json(buildOpenApiDocument(routeDefinitions));
}
