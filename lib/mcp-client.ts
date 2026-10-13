/**
 * A real MCP client over Streamable HTTP. The simulator uses this to talk to
 * /api/mcp exactly like an external assistant (e.g. Alexa+) would: over the network,
 * with the same auth header, through the same protocol handshake.
 */
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

export interface McpSession {
  client: Client;
  tools: { name: string; description?: string; inputSchema: unknown }[];
  protocolVersion: string;
  serverName: string;
  close: () => Promise<void>;
}

export async function connectMcp(endpoint: string): Promise<McpSession> {
  const headers: Record<string, string> = {};
  if (process.env.MCP_API_KEY) headers.Authorization = `Bearer ${process.env.MCP_API_KEY}`;

  const client = new Client({ name: "hearth-simulator", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), { requestInit: { headers } });
  await client.connect(transport);

  const { tools } = await client.listTools();
  return {
    client,
    tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    protocolVersion: client.getNegotiatedProtocolVersion() ?? "unknown",
    serverName: client.getServerVersion()?.name ?? "unknown",
    close: async () => {
      try {
        await client.close();
      } catch {
        /* stateless server: nothing to tear down */
      }
    },
  };
}

/** Call a tool and return parsed JSON (tools reply with one JSON text block). */
export async function callTool(
  session: McpSession,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; data: unknown; raw: string }> {
  const res = await session.client.callTool({ name, arguments: args });
  const raw = (res.content as { type: string; text?: string }[])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  let data: unknown = raw;
  try {
    data = JSON.parse(raw);
  } catch {
    /* keep raw text */
  }
  return { isError: !!res.isError, data, raw };
}
