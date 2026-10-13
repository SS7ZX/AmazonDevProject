/**
 * The simulator's agent loop: user text -> Bedrock (Converse + tool use) -> MCP tool calls -> answer.
 * Falls back to lib/offline.ts when Bedrock credentials are not configured.
 */
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
  type ToolConfiguration,
} from "@aws-sdk/client-bedrock-runtime";
import { callTool, connectMcp } from "./mcp-client";
import { runOffline, type TraceStep } from "./offline";
import { todayISO, weekdayName, TZ } from "./dates";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AgentResult {
  reply: string;
  trace: TraceStep[];
  brain: "bedrock" | "offline";
  model?: string;
  protocolVersion: string;
  serverName: string;
}

export const bedrockConfigured = () =>
  !!(process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY);

const MODEL_ID = () => process.env.BEDROCK_MODEL_ID || "us.amazon.nova-lite-v1:0";
const MAX_STEPS = 6;

const systemPrompt = () =>
  [
    "You are the voice of a household assistant. Replies are spoken aloud, so keep them short (one or two sentences), warm, and free of markdown, lists or emoji.",
    `Today is ${weekdayName()}, ${todayISO()} (timezone ${TZ}). Convert relative dates like "Friday" or "tomorrow" to YYYY-MM-DD yourself before calling tools.`,
    "Use the provided tools for every household fact or change; never invent list contents.",
    "If the user speaks Bahasa Indonesia, answer in Bahasa Indonesia.",
    "If a tool returns an error, read its message and recover (for example, ask which item they meant) instead of apologizing at length.",
  ].join("\n");

export async function runAgent(endpoint: string, history: ChatTurn[]): Promise<AgentResult> {
  const session = await connectMcp(endpoint);
  const base = { protocolVersion: session.protocolVersion, serverName: session.serverName };
  try {
    const last = history[history.length - 1]?.text ?? "";

    if (!bedrockConfigured()) {
      const { reply, trace } = await runOffline(session, last);
      return { reply, trace, brain: "offline", ...base };
    }

    const bedrock = new BedrockRuntimeClient({
      region: process.env.APP_AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
      },
    });

    const toolConfig: ToolConfiguration = {
      tools: session.tools.map((t) => ({
        toolSpec: {
          name: t.name,
          description: t.description,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inputSchema: { json: t.inputSchema as any },
        },
      })),
    };

    const messages: Message[] = history.slice(-12).map((h) => ({
      role: h.role,
      content: [{ text: h.text }],
    }));
    const trace: TraceStep[] = [];

    for (let step = 0; step < MAX_STEPS; step++) {
      const out = await bedrock.send(
        new ConverseCommand({
          modelId: MODEL_ID(),
          system: [{ text: systemPrompt() }],
          messages,
          toolConfig,
          inferenceConfig: { maxTokens: 600, temperature: 0.2 },
        }),
      );

      const msg = out.output?.message;
      if (!msg) break;
      messages.push(msg);

      const uses = (msg.content ?? []).filter((b): b is ContentBlock.ToolUseMember => "toolUse" in b);
      if (out.stopReason !== "tool_use" || uses.length === 0) {
        const reply = (msg.content ?? []).map((b) => ("text" in b ? b.text : "")).join(" ").trim();
        return { reply: reply || "Done.", trace, brain: "bedrock", model: MODEL_ID(), ...base };
      }

      const results: ContentBlock[] = [];
      for (const u of uses) {
        const tu = u.toolUse!;
        const args = (tu.input ?? {}) as Record<string, unknown>;
        const t0 = Date.now();
        let isError = false;
        let data: unknown;
        let raw: string;
        try {
          const r = await callTool(session, tu.name!, args);
          isError = r.isError;
          data = r.data;
          raw = r.raw;
        } catch (e) {
          isError = true;
          raw = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
          data = JSON.parse(raw);
        }
        trace.push({ tool: tu.name!, args, isError, result: data, ms: Date.now() - t0 });
        results.push({
          toolResult: { toolUseId: tu.toolUseId, content: [{ text: raw }], status: isError ? "error" : "success" },
        });
      }
      messages.push({ role: "user", content: results });
    }

    return { reply: "I got stuck working that out. Could you say it another way?", trace, brain: "bedrock", model: MODEL_ID(), ...base };
  } finally {
    await session.close();
  }
}
