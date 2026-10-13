/**
 * End-to-end smoke test for the deployed (or local) MCP server.
 *
 *   BASE_URL=https://your-app.vercel.app MCP_API_KEY=... npm run smoke
 *   (defaults to http://localhost:3000)
 *
 * It proves, with real network calls:
 *   1. a modern client (MCP SDK v2, spec 2026-07-28) can connect and call tools
 *   2. a 2025-era client (MCP SDK 1.x, spec 2025-11-25) can connect and call tools
 *   3. a raw JSON-RPC `initialize` with protocolVersion 2025-11-25 works over plain HTTP
 *   4. auth is enforced when MCP_API_KEY is set
 */
import { Client as ModernClient, StreamableHTTPClientTransport as ModernTransport } from "@modelcontextprotocol/client";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport as LegacyTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const URL_ = `${BASE}/api/mcp`;
const KEY = process.env.MCP_API_KEY;
const headers = KEY ? { Authorization: `Bearer ${KEY}` } : {};

let failed = 0;
const pass = (m) => console.log(`  \u2713 ${m}`);
const fail = (m) => { failed++; console.log(`  \u2717 ${m}`); };
const check = (cond, m) => (cond ? pass(m) : fail(m));
const text = (r) => r.content.map((c) => c.text ?? "").join("");
const json = (r) => JSON.parse(text(r));

const EXPECTED = ["add_grocery_item","list_groceries","check_off_grocery","clear_checked_groceries","add_chore","list_chores","complete_chore","add_bill_reminder","list_bills","mark_bill_paid","household_summary"];

async function exercise(label, client) {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  check(EXPECTED.every((n) => names.includes(n)), `${label}: lists all ${EXPECTED.length} tools (${names.length} found)`);

  const unique = `testitem-${Date.now()}`;
  let r = await client.callTool({ name: "add_grocery_item", arguments: { name: unique, quantity: "2" } });
  check(!r.isError && json(r).item?.data?.name === unique, `${label}: add_grocery_item works`);

  r = await client.callTool({ name: "list_groceries", arguments: {} });
  check(json(r).items.some((i) => i.name === unique), `${label}: list_groceries sees the new item`);

  r = await client.callTool({ name: "check_off_grocery", arguments: { name: unique.slice(0, 12) } });
  check(!r.isError, `${label}: check_off_grocery matches by partial name`);

  r = await client.callTool({ name: "add_bill_reminder", arguments: { name: `bill-${unique}`, due_date: "2020-01-01", amount: 100000 } });
  check(!r.isError, `${label}: add_bill_reminder works`);

  r = await client.callTool({ name: "list_bills", arguments: {} });
  check(json(r).bills.find((b) => b.name === `bill-${unique}`)?.overdue === true, `${label}: past-due bill is flagged overdue`);

  r = await client.callTool({ name: "add_bill_reminder", arguments: { name: "bad", due_date: "next friday" } });
  check(r.isError === true || /date|YYYY/i.test(text(r)), `${label}: invalid date is rejected with a helpful error`);

  r = await client.callTool({ name: "mark_bill_paid", arguments: { name: `bill-${unique}` } });
  check(!r.isError, `${label}: mark_bill_paid works`);

  r = await client.callTool({ name: "household_summary", arguments: {} });
  check(typeof json(r).message === "string" && !!json(r).today, `${label}: household_summary returns a briefing`);
}

console.log(`\nTesting ${URL_}\n`);

console.log("1) Modern client (MCP SDK v2)");
try {
  const c = new ModernClient({ name: "smoke-modern", version: "1.0.0" });
  await c.connect(new ModernTransport(new URL(URL_), { requestInit: { headers } }));
  pass(`connected, negotiated protocol ${c.getNegotiatedProtocolVersion()}, server ${c.getServerVersion()?.name}`);
  await exercise("v2", c);
  await c.close().catch(() => {});
} catch (e) { fail(`v2 client error: ${e?.message ?? e}`); }

console.log("\n2) 2025-era client (MCP SDK 1.x, spec 2025-11-25)");
try {
  const c = new LegacyClient({ name: "smoke-legacy", version: "1.0.0" });
  const t = new LegacyTransport(new URL(URL_), { requestInit: { headers } });
  await c.connect(t);
  pass(`connected, protocol ${t.protocolVersion}, server ${c.getServerVersion()?.name}`);
  check(["2025-11-25", "2026-07-28"].includes(t.protocolVersion), "protocol is 2025-11-25 or later");
  await exercise("v1", c);
  await c.close().catch(() => {});
} catch (e) { fail(`legacy client error: ${e?.message ?? e}`); }

console.log("\n3) Raw JSON-RPC initialize (protocolVersion 2025-11-25)");
try {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "curl", version: "0" } } }),
  });
  const body = await res.text();
  check(res.ok, `HTTP ${res.status}`);
  check(/"protocolVersion"/.test(body), "response contains a negotiated protocolVersion");
  console.log("    " + body.replace(/\s+/g, " ").slice(0, 200));
} catch (e) { fail(`raw initialize error: ${e?.message ?? e}`); }

console.log("\n4) Auth");
if (KEY) {
  const res = await fetch(URL_, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "{}" });
  check(res.status === 401, `request without a token is rejected (HTTP ${res.status})`);
} else {
  console.log("  - MCP_API_KEY not set, skipping (the endpoint is open). Set one before deploying!");
}

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nAll checks passed\n");
process.exit(failed ? 1 : 0);
