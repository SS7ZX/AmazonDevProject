/**
 * Offline brain: a tiny rule-based parser (English + Bahasa Indonesia) used when
 * AWS Bedrock is not configured. It still goes through the MCP server for every
 * action, so the demo path is identical; only the language understanding is simpler.
 */
import { callTool, type McpSession } from "./mcp-client";
import { todayISO, TZ } from "./dates";

export interface TraceStep {
  tool: string;
  args: Record<string, unknown>;
  isError: boolean;
  result: unknown;
  ms: number;
}

const DAYS: Record<string, number> = {
  sunday: 0, minggu: 0, monday: 1, senin: 1, tuesday: 2, selasa: 2, wednesday: 3, rabu: 3,
  thursday: 4, kamis: 4, friday: 5, jumat: 5, saturday: 6, sabtu: 6,
};

function addDays(iso: string, n: number) {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
}

export function parseDate(text: string): string | undefined {
  const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const today = todayISO();
  if (/\b(today|hari ini)\b/i.test(text)) return today;
  if (/\b(tomorrow|besok)\b/i.test(text)) return addDays(today, 1);
  const wd = Object.keys(DAYS).find((d) => new RegExp(`\\b${d}\\b`, "i").test(text));
  if (wd) {
    const nowDow = new Date(Date.parse(today + "T00:00:00Z")).getUTCDay();
    let diff = (DAYS[wd] - nowDow + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(today, diff);
  }
  return undefined;
}

const clean = (s: string) => s.replace(/[.!?]+$/, "").replace(/^(the|some|a|an)\s+/i, "").trim();

export async function runOffline(session: McpSession, text: string) {
  const t = text.trim();
  const trace: TraceStep[] = [];
  const call = async (tool: string, args: Record<string, unknown>) => {
    const t0 = Date.now();
    const r = await callTool(session, tool, args);
    trace.push({ tool, args, isError: r.isError, result: r.data, ms: Date.now() - t0 });
    return r.data as Record<string, unknown>;
  };
  const say = (d: Record<string, unknown>) => String(d.message ?? d.error ?? "Done.");
  let m: RegExpMatchArray | null;

  if ((m = t.match(/(?:add|put|tambah(?:kan|in)?)\s+(.+?)\s+(?:to|on|ke)\s+(?:the\s+|my\s+|daftar\s+)?(?:grocer\w*|shopping|belanja)/i))) {
    const items = m[1].split(/\s*,\s*|\s+(?:and|dan)\s+/i).map(clean).filter(Boolean);
    const said: string[] = [];
    for (const name of items) said.push(say(await call("add_grocery_item", { name })));
    return { reply: said.length > 1 ? `Added ${items.join(", ")}.` : said[0], trace };
  }

  if (/(grocer|shopping list|belanja)/i.test(t) && /(what|show|list|read|apa|lihat|isi)/i.test(t))
    return { reply: say(await call("list_groceries", {})), trace };

  if ((m = t.match(/(?:bought|got|check off|cross off|sudah beli|coret)\s+(.+)/i)))
    return { reply: say(await call("check_off_grocery", { name: clean(m[1]) })), trace };

  if ((m = t.match(/(?:add|new|tambah(?:kan|in)?)\s+(?:a\s+)?(?:chore|tugas)[:\s]+(.+)$/i))) {
    const due = parseDate(m[1]);
    let rest = m[1]
      .replace(/[,\s]+(?:due|by|on|before|pada)\b.*$/i, "")
      .replace(new RegExp(`[,\\s]+(?:${["tomorrow", "today", "besok", "hari ini", ...Object.keys(DAYS)].join("|")})\\s*$`, "i"), "")
      .replace(/[.!?]+$/, "");
    let assignee: string | undefined;
    const a = rest.match(/[,\s]+(?:for|untuk)\s+(\w+)\s*$/i);
    if (a) { assignee = a[1]; rest = rest.slice(0, a.index); }
    const args: Record<string, unknown> = { title: clean(rest) };
    if (assignee) args.assignee = assignee;
    if (due) args.due_date = due;
    return { reply: say(await call("add_chore", args)), trace };
  }

  if (/(chore|tugas)/i.test(t) && /(what|show|list|apa|lihat)/i.test(t))
    return { reply: say(await call("list_chores", {})), trace };

  if ((m = t.match(/(?:finished|done with|completed|selesai(?:kan)?)\s+(.+)/i)))
    return { reply: say(await call("complete_chore", { title: clean(m[1]) })), trace };

  if ((m = t.match(/(?:remind me (?:to )?pay|pay|bayar|ingetin bayar|ingatkan bayar)\s+(?:the\s+)?(.+?)(?:\s+(?:bill|tagihan))?(?:\s+(?:on|by|due|pada|hari|before)\b.*|\s+\d{4}-\d{2}-\d{2}.*)?$/i))) {
    const due = parseDate(t);
    if (!due) return { reply: "When is it due? Say a day like Friday or a date like 2026-10-16.", trace };
    return { reply: say(await call("add_bill_reminder", { name: clean(m[1]), due_date: due })), trace };
  }

  if (/(bills?|tagihan)/i.test(t) && /(what|show|list|due|apa|lihat)/i.test(t))
    return { reply: say(await call("list_bills", {})), trace };

  if ((m = t.match(/(?:paid|sudah bayar|lunas)\s+(?:the\s+)?(.+?)(?:\s+bill)?$/i)))
    return { reply: say(await call("mark_bill_paid", { name: clean(m[1]) })), trace };

  if (/(summary|status|going on|brief|ringkas|rangkum|hari ini)/i.test(t))
    return { reply: say(await call("household_summary", {})), trace };

  return {
    reply:
      "Offline mode understands: add milk to groceries, what's on the grocery list, add chore Take out trash for Dewi, remind me to pay electricity on Friday, give me a summary. Connect Bedrock for free-form requests.",
    trace,
  };
}

export const offlineNote = `Offline mode (no Bedrock credentials). Timezone ${TZ}.`;
