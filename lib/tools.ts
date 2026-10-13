/**
 * Hearth tools: the household operations exposed over MCP.
 *
 * Design rules (they make the tools easy for any voice assistant / LLM to use):
 *  - Tools take human names ("milk", "electricity"), never opaque ids.
 *  - Dates are ISO (YYYY-MM-DD); the caller resolves "Friday" using today's date.
 *  - Every tool returns small JSON with a human-readable `message`.
 *  - Failures return isError with a message that tells the caller how to recover.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getStore, type Item, type Kind } from "./store";
import { daysUntil, isISODate, todayISO, weekdayName, TZ } from "./dates";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const ok = (payload: Record<string, unknown>): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(payload) }],
});

const fail = (message: string, extra: Record<string, unknown> = {}): ToolResult => ({
  isError: true,
  content: [{ type: "text", text: JSON.stringify({ error: message, ...extra }) }],
});

const name = (i: Item) => String(i.data.name ?? i.data.title ?? "");

/** Find one item by exact id, exact name, or unique substring. */
function resolve(
  items: Item[],
  query: string,
): { item?: Item; candidates?: Item[] } {
  const q = query.trim().toLowerCase();
  const byId = items.find((i) => i.id.toLowerCase() === q);
  if (byId) return { item: byId };
  const exact = items.filter((i) => name(i).toLowerCase() === q);
  if (exact.length === 1) return { item: exact[0] };
  const partial = items.filter((i) => name(i).toLowerCase().includes(q));
  if (partial.length === 1) return { item: partial[0] };
  return { candidates: exact.length > 1 ? exact : partial };
}

const isoDate = z
  .string()
  .refine(isISODate, "Use YYYY-MM-DD, e.g. 2026-10-16");

export function registerHouseholdTools(server: McpServer) {
  const store = getStore();

  /* ------------------------------ groceries ------------------------------ */

  server.registerTool(
    "add_grocery_item",
    {
      title: "Add grocery item",
      description:
        "Add an item to the shared grocery list. If the item is already on the list (unchecked), it is not duplicated.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Item name, e.g. 'milk'"),
        quantity: z.string().optional().describe("Optional amount, e.g. '2 liters' or '12'"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ name: n, quantity }) => {
      const existing = (await store.list("grocery")).find(
        (i) => name(i).toLowerCase() === n.trim().toLowerCase() && !i.data.checked,
      );
      if (existing) {
        if (quantity) await store.update("grocery", existing.id, { quantity });
        return ok({ message: `${n} is already on the list.`, duplicate: true });
      }
      const item = await store.add("grocery", { name: n.trim(), quantity: quantity ?? null, checked: false });
      return ok({ message: `Added ${n.trim()}${quantity ? ` (${quantity})` : ""}.`, item });
    },
  );

  server.registerTool(
    "list_groceries",
    {
      title: "List groceries",
      description: "Show what is on the shared grocery list.",
      inputSchema: z.object({
        include_checked: z.boolean().optional().describe("Also show items already bought. Default false."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ include_checked }) => {
      const all = await store.list("grocery");
      const items = include_checked ? all : all.filter((i) => !i.data.checked);
      return ok({
        count: items.length,
        items: items.map((i) => ({ name: name(i), quantity: i.data.quantity, checked: !!i.data.checked })),
        message: items.length ? `${items.length} item(s) on the list.` : "The grocery list is empty.",
      });
    },
  );

  server.registerTool(
    "check_off_grocery",
    {
      title: "Check off grocery item",
      description: "Mark a grocery item as bought. Matches by name (partial names are fine).",
      inputSchema: z.object({ name: z.string().min(1).describe("Item to mark as bought") }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ name: n }) => {
      const open = (await store.list("grocery")).filter((i) => !i.data.checked);
      const { item, candidates } = resolve(open, n);
      if (!item) {
        return candidates?.length
          ? fail(`'${n}' matches several items. Be more specific.`, { candidates: candidates.map(name) })
          : fail(`No unchecked grocery item matches '${n}'.`, { onList: open.map(name) });
      }
      await store.update("grocery", item.id, { checked: true });
      return ok({ message: `Checked off ${name(item)}.` });
    },
  );

  server.registerTool(
    "clear_checked_groceries",
    {
      title: "Clear bought groceries",
      description: "Remove every item already marked as bought from the grocery list.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async () => {
      const done = (await store.list("grocery")).filter((i) => i.data.checked);
      for (const i of done) await store.remove("grocery", i.id);
      return ok({ message: `Cleared ${done.length} bought item(s).`, removed: done.length });
    },
  );

  /* -------------------------------- chores -------------------------------- */

  server.registerTool(
    "add_chore",
    {
      title: "Add chore",
      description: "Create a household chore, optionally assigned to a person and with a due date.",
      inputSchema: z.object({
        title: z.string().min(1).describe("What needs doing, e.g. 'Take out the trash'"),
        assignee: z.string().optional().describe("Who should do it, e.g. 'Dewi'"),
        due_date: isoDate.optional().describe("Due date, YYYY-MM-DD"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ title, assignee, due_date }) => {
      const item = await store.add("chore", {
        title: title.trim(),
        assignee: assignee?.trim() ?? null,
        dueDate: due_date ?? null,
        done: false,
      });
      return ok({
        message: `Added chore '${title.trim()}'${assignee ? ` for ${assignee}` : ""}${due_date ? `, due ${due_date}` : ""}.`,
        item,
      });
    },
  );

  server.registerTool(
    "list_chores",
    {
      title: "List chores",
      description: "List chores, optionally filtered by person or status.",
      inputSchema: z.object({
        assignee: z.string().optional().describe("Only this person's chores"),
        status: z.enum(["open", "done", "all"]).optional().describe("Default 'open'"),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ assignee, status = "open" }) => {
      let items = await store.list("chore");
      if (status !== "all") items = items.filter((i) => (status === "done") === !!i.data.done);
      if (assignee)
        items = items.filter((i) => String(i.data.assignee ?? "").toLowerCase() === assignee.trim().toLowerCase());
      const rows = items.map((i) => ({
        title: name(i),
        assignee: i.data.assignee,
        dueDate: i.data.dueDate,
        done: !!i.data.done,
        overdue: !i.data.done && !!i.data.dueDate && daysUntil(String(i.data.dueDate)) < 0,
      }));
      return ok({ count: rows.length, chores: rows, message: rows.length ? `${rows.length} chore(s).` : "No chores found." });
    },
  );

  server.registerTool(
    "complete_chore",
    {
      title: "Complete chore",
      description: "Mark a chore as done. Matches by title (partial titles are fine).",
      inputSchema: z.object({ title: z.string().min(1).describe("Chore title or part of it") }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ title }) => {
      const open = (await store.list("chore")).filter((i) => !i.data.done);
      const { item, candidates } = resolve(open, title);
      if (!item) {
        return candidates?.length
          ? fail(`'${title}' matches several chores. Be more specific.`, { candidates: candidates.map(name) })
          : fail(`No open chore matches '${title}'.`, { open: open.map(name) });
      }
      await store.update("chore", item.id, { done: true, completedAt: new Date().toISOString() });
      return ok({ message: `Marked '${name(item)}' as done.` });
    },
  );

  /* -------------------------------- bills --------------------------------- */

  server.registerTool(
    "add_bill_reminder",
    {
      title: "Add bill reminder",
      description: "Remember a bill and its due date so the household can be reminded.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Bill name, e.g. 'Electricity'"),
        due_date: isoDate.describe("Due date, YYYY-MM-DD"),
        amount: z.number().positive().optional().describe("Amount, if known"),
        currency: z.string().length(3).optional().describe("ISO currency code. Default IDR."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ name: n, due_date, amount, currency }) => {
      const item = await store.add("bill", {
        name: n.trim(),
        dueDate: due_date,
        amount: amount ?? null,
        currency: (currency ?? "IDR").toUpperCase(),
        paid: false,
      });
      const d = daysUntil(due_date);
      const when = d < 0 ? `${-d} day(s) ago` : d === 0 ? "today" : `in ${d} day(s)`;
      return ok({ message: `I'll remember ${n.trim()}, due ${due_date} (${when}).`, item });
    },
  );

  server.registerTool(
    "list_bills",
    {
      title: "List bills",
      description: "List unpaid bills, soonest first. Overdue bills are flagged.",
      inputSchema: z.object({
        within_days: z.number().int().min(0).max(365).optional().describe("Only bills due within this many days (overdue always included)"),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ within_days }) => {
      const bills = (await store.list("bill"))
        .filter((i) => !i.data.paid)
        .map((i) => ({
          name: name(i),
          dueDate: String(i.data.dueDate),
          amount: i.data.amount,
          currency: i.data.currency,
          daysUntilDue: daysUntil(String(i.data.dueDate)),
        }))
        .filter((b) => within_days === undefined || b.daysUntilDue <= within_days)
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
        .map((b) => ({ ...b, overdue: b.daysUntilDue < 0 }));
      return ok({ count: bills.length, bills, message: bills.length ? `${bills.length} unpaid bill(s).` : "No unpaid bills." });
    },
  );

  server.registerTool(
    "mark_bill_paid",
    {
      title: "Mark bill paid",
      description: "Mark a bill as paid. Matches by name (partial names are fine).",
      inputSchema: z.object({ name: z.string().min(1).describe("Bill name or part of it") }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ name: n }) => {
      const unpaid = (await store.list("bill")).filter((i) => !i.data.paid);
      const { item, candidates } = resolve(unpaid, n);
      if (!item) {
        return candidates?.length
          ? fail(`'${n}' matches several bills. Be more specific.`, { candidates: candidates.map(name) })
          : fail(`No unpaid bill matches '${n}'.`, { unpaid: unpaid.map(name) });
      }
      await store.update("bill", item.id, { paid: true, paidAt: new Date().toISOString() });
      return ok({ message: `Marked ${name(item)} as paid.` });
    },
  );

  /* ------------------------------- summary -------------------------------- */

  server.registerTool(
    "household_summary",
    {
      title: "Household summary",
      description:
        "A morning-briefing style overview: today's date, overdue and upcoming bills, open chores, and the grocery count. Good answer to 'what's going on at home?'",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const [groceries, chores, bills] = await Promise.all(
        (["grocery", "chore", "bill"] as Kind[]).map((k) => store.list(k)),
      );
      const unpaid = bills
        .filter((b) => !b.data.paid)
        .map((b) => ({ name: name(b), dueDate: String(b.data.dueDate), days: daysUntil(String(b.data.dueDate)) }));
      const overdue = unpaid.filter((b) => b.days < 0);
      const soon = unpaid.filter((b) => b.days >= 0 && b.days <= 7).sort((a, b) => a.days - b.days);
      const openChores = chores.filter((c) => !c.data.done);
      const overdueChores = openChores.filter((c) => c.data.dueDate && daysUntil(String(c.data.dueDate)) < 0);
      const toBuy = groceries.filter((g) => !g.data.checked).length;

      const parts: string[] = [];
      if (overdue.length) parts.push(`${overdue.length} overdue bill(s): ${overdue.map((b) => b.name).join(", ")}`);
      if (soon.length) parts.push(`due this week: ${soon.map((b) => `${b.name} (${b.days === 0 ? "today" : `in ${b.days}d`})`).join(", ")}`);
      parts.push(`${openChores.length} open chore(s)${overdueChores.length ? `, ${overdueChores.length} overdue` : ""}`);
      parts.push(`${toBuy} grocery item(s) to buy`);

      return ok({
        today: todayISO(),
        weekday: weekdayName(),
        timezone: TZ,
        overdueBills: overdue,
        billsDueThisWeek: soon,
        openChores: openChores.length,
        overdueChores: overdueChores.length,
        groceriesToBuy: toBuy,
        message: parts.join("; ") + ".",
      });
    },
  );
}
