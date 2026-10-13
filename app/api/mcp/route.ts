/**
 * The MCP server.
 *
 * - Transport: Streamable HTTP, stateless (fits Vercel serverless functions).
 * - Endpoint:  POST /api/mcp
 * - Protocol:  mcp-handler 2.x on MCP SDK v2 serves spec 2026-07-28 natively and
 *              falls back to stateless Streamable HTTP for 2025-era clients
 *              (e.g. 2025-11-25), from this one route.
 * - Auth:      optional shared secret via MCP_API_KEY (Authorization: Bearer ...).
 */
import { createMcpHandler } from "mcp-handler";
import { registerHouseholdTools } from "@/lib/tools";
import { checkBearer, unauthorized } from "@/lib/auth";

const mcp = createMcpHandler(
  (server) => {
    registerHouseholdTools(server);
  },
  {
    serverInfo: { name: "hearth-household-ops", version: "1.0.0" },
    instructions:
      "Hearth manages a shared household: groceries, chores and bill reminders. " +
      "Dates are ISO (YYYY-MM-DD). Prefer household_summary for open-ended questions about what is going on at home.",
  },
);

async function guarded(req: Request) {
  if (!checkBearer(req)) return unauthorized();
  return mcp(req);
}

export { guarded as GET, guarded as POST };
export const maxDuration = 60;
