import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { daysUntil, todayISO, weekdayName } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Read-only snapshot for the "Household" board. Not part of the MCP surface. */
export async function GET() {
  const store = getStore();
  const [g, c, b] = await Promise.all([store.list("grocery"), store.list("chore"), store.list("bill")]);
  return NextResponse.json({
    backend: store.backend,
    today: todayISO(),
    weekday: weekdayName(),
    groceries: g.map((i) => ({ id: i.id, ...i.data })),
    chores: c.map((i) => ({ id: i.id, ...i.data })),
    bills: b.map((i) => ({ id: i.id, ...i.data, daysUntilDue: daysUntil(String(i.data.dueDate)) })),
  });
}

/**
 * Demo helper: wipe everything so you can re-record the video from a clean slate.
 * Disabled unless ALLOW_DEMO_RESET=1 (so a public deployment can't be wiped by strangers).
 */
export async function DELETE() {
  if (process.env.ALLOW_DEMO_RESET !== "1") {
    return NextResponse.json({ error: "Reset is disabled. Set ALLOW_DEMO_RESET=1." }, { status: 403 });
  }
  const store = getStore();
  for (const kind of ["grocery", "chore", "bill"] as const) {
    for (const i of await store.list(kind)) await store.remove(kind, i.id);
  }
  return NextResponse.json({ ok: true });
}
