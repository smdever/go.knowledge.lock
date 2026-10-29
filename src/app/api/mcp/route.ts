import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";
import { DemoError } from "@/lib/demo/service";
import { chargeApiKey } from "@/lib/app/api";
import { keyFromRequest } from "@/lib/app/apikeys";
import { knowledgeLockMcp } from "@/lib/app/mcp";

export const maxDuration = 120;

const jsonRpcError = (status: number, message: string, headers: Record<string, string> = {}) =>
  NextResponse.json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }, { status, headers });

/**
 * POST /api/mcp — Knowledge Lock's MCP server (Streamable HTTP, stateless, JSON responses).
 * Connect with an organisation API key: Authorization: Bearer kl_live_…
 */
export async function POST(request: Request) {
  const caller = await keyFromRequest(request);
  if (!caller) {
    return jsonRpcError(401, "Missing or invalid API key. Create one on the API keys page in Knowledge Lock and send it as: Authorization: Bearer kl_live_…", {
      "WWW-Authenticate": 'Bearer realm="Knowledge Lock"',
    });
  }
  try {
    await chargeApiKey(caller);
  } catch (err) {
    if (err instanceof DemoError) return jsonRpcError(err.status, err.message, err.status === 429 ? { "Retry-After": "3600" } : {});
    throw err;
  }
  const server = knowledgeLockMcp(caller);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

/** This server keeps no sessions or event streams, so only POST is used. */
const notAllowed = () => jsonRpcError(405, "Use POST. This MCP server doesn't keep sessions or open event streams.", { Allow: "POST" });
export const GET = notAllowed;
export const DELETE = notAllowed;
