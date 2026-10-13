import { NextResponse } from "next/server";
import { runAgent, bedrockConfigured, type ChatTurn } from "@/lib/agent";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { history?: ChatTurn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const history = (body.history ?? []).filter((h) => h && typeof h.text === "string" && h.text.trim());
  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "history must end with a user message" }, { status: 400 });
  }

  // Talk to our own MCP endpoint over real HTTP, like any external assistant would.
  const endpoint = `${new URL(req.url).origin}/api/mcp`;
  try {
    const result = await runAgent(endpoint, history);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("chat error:", message);
    return NextResponse.json(
      {
        error: bedrockConfigured()
          ? `The assistant hit an error: ${message}`
          : `Could not reach the MCP server: ${message}`,
      },
      { status: 502 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ brain: bedrockConfigured() ? "bedrock" : "offline" });
}
