"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ----------------------------------------------------------------- types */
type Turn = { role: "user" | "assistant"; text: string; error?: boolean };
type Step = { tool: string; args: Record<string, unknown>; isError: boolean; result: unknown; ms: number };
type Meta = { brain: "bedrock" | "offline"; model?: string; protocolVersion: string; serverName: string };
type Snapshot = {
  backend: string;
  today: string;
  weekday: string;
  groceries: { id: string; name: string; quantity?: string | null; checked?: boolean }[];
  chores: { id: string; title: string; assignee?: string | null; dueDate?: string | null; done?: boolean }[];
  bills: { id: string; name: string; dueDate: string; amount?: number | null; currency?: string; paid?: boolean; daysUntilDue: number }[];
};

/* Minimal typing for the browser speech API (not in lib.dom for every TS version). */
type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const TRY = [
  "Add milk and eggs to the grocery list",
  "Remind me to pay electricity on Friday",
  "Add chore: take out the trash for Dewi, due tomorrow",
  "Give me a summary of the house",
  "Tambahin sabun cuci ke daftar belanja",
];

/* ------------------------------------------------------------------ page */
export default function Page() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [lang, setLang] = useState("en-US");
  const [text, setText] = useState("");
  const [canListen, setCanListen] = useState(false);
  const [brain, setBrain] = useState<string>("…");
  const recRef = useRef<SpeechRec | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (r.ok) setSnap(await r.json());
    } catch { /* board is a nicety; ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    fetch("/api/chat").then((r) => r.json()).then((j) => setBrain(j.brain)).catch(() => setBrain("?"));
    const w = window as unknown as Record<string, unknown>;
    setCanListen(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, [refresh]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [turns, busy]);

  const say = useCallback((t: string) => {
    if (!speak || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = lang;
    speechSynthesis.speak(u);
  }, [speak, lang]);

  const send = useCallback(async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    const history: Turn[] = [...turns.filter((t) => !t.error), { role: "user", text: message }];
    setTurns([...turns, { role: "user", text: message }]);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history: history.map(({ role, text }) => ({ role, text })) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
      setTurns((t) => [...t, { role: "assistant", text: j.reply }]);
      setSteps((s) => [...j.trace, ...s]);
      setMeta({ brain: j.brain, model: j.model, protocolVersion: j.protocolVersion, serverName: j.serverName });
      say(j.reply);
      refresh();
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", text: e instanceof Error ? e.message : "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  }, [busy, turns, say, refresh]);

  const toggleListen = () => {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as Record<string, new () => SpeechRec>;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    let heard = "";
    rec.onresult = (e) => { heard = e.results[0]?.[0]?.transcript ?? ""; };
    rec.onerror = () => setListening(false);
    rec.onend = () => { setListening(false); if (heard) send(heard); };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const reset = async () => {
    await fetch("/api/state", { method: "DELETE" });
    setTurns([]); setSteps([]); refresh();
  };

  const state = busy ? "thinking" : listening ? "listening" : "idle";
  const hint = busy ? "Working on it…" : listening ? "Listening. Say what the house needs." : canListen ? "Tap the lamp and speak, or type below." : "Voice input isn't available in this browser. Type below.";

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <h1>Hearth</h1>
          <p>Groceries, chores and bills for the whole household, spoken to an assistant.</p>
        </div>
        <div className="status" aria-label="Connection details">
          <span>brain <b>{meta?.brain ?? brain}{meta?.model ? ` · ${meta.model}` : ""}</b></span>
          <span>mcp <b>{meta ? `${meta.serverName} @ ${meta.protocolVersion}` : "not yet called"}</b></span>
          <span>data <b>{snap?.backend ?? "…"}</b></span>
        </div>
      </header>

      <section aria-label="Conversation">
        <div className="talk">
          <button className="lamp" data-state={state} onClick={toggleListen} disabled={busy || !canListen}
            aria-label={listening ? "Stop listening" : "Start listening"}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.92V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.58A6 6 0 0 0 18 11.5Z" />
            </svg>
          </button>
          <p className="talk-hint" aria-live="polite">{hint}</p>
          <div className="controls">
            <label>Language
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="en-US">English</option>
                <option value="id-ID">Bahasa Indonesia</option>
              </select>
            </label>
            <label><input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} /> Speak replies</label>
          </div>
        </div>

        <ol className="transcript" aria-live="polite">
          {turns.length === 0 && <li className="empty">Nothing said yet. The house is quiet.</li>}
          {turns.map((t, i) => (
            <li key={i} className={`line ${t.role}${t.error ? " error" : ""}`}>{t.text}</li>
          ))}
          <div ref={endRef} />
        </ol>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a request" aria-label="Type a request" />
          <button type="submit" disabled={busy || !text.trim()}>Send</button>
        </form>
        <div className="tryit" aria-label="Example requests">
          {TRY.map((t) => <button key={t} onClick={() => send(t)} disabled={busy}>{t}</button>)}
        </div>
      </section>

      <aside className="side">
        <section aria-label="MCP calls">
          <h2>What the server did</h2>
          <p className="sub">Every action below is a real MCP tool call over Streamable HTTP.</p>
          <div className="trace">
            {steps.length === 0 && <div className="trace-empty">Tool calls show up here as the assistant works. Ask for something.</div>}
            {steps.map((s, i) => (
              <details key={i} className={`call${s.isError ? " err" : ""}`} open={i === 0}>
                <summary><span>{s.tool}</span><span className="ms">{s.ms} ms</span></summary>
                {typeof (s.result as { message?: string })?.message === "string" && <p className="msg">{(s.result as { message: string }).message}</p>}
                {!!(s.result as { error?: string })?.error && <p className="msg">{(s.result as { error: string }).error}</p>}
                <pre>{"args   " + JSON.stringify(s.args)}{"\n"}{"result " + JSON.stringify(s.result, null, 1)}</pre>
              </details>
            ))}
          </div>
        </section>

        <section aria-label="Household">
          <h2>The household</h2>
          <p className="sub">{snap ? `${snap.weekday}, ${snap.today}` : "Loading…"}</p>
          <div className="board">
            <section>
              <h3>Groceries<span>{snap ? snap.groceries.filter((g) => !g.checked).length : 0}</span></h3>
              <ul>
                {snap?.groceries.length ? snap.groceries.map((g) => (
                  <li key={g.id} className={g.checked ? "done" : ""}><i className="tick" />{g.name}{g.quantity && <span className="meta">{g.quantity}</span>}</li>
                )) : <li className="none">Nothing to buy.</li>}
              </ul>
            </section>
            <section>
              <h3>Chores<span>{snap ? snap.chores.filter((c) => !c.done).length : 0}</span></h3>
              <ul>
                {snap?.chores.length ? snap.chores.map((c) => (
                  <li key={c.id} className={c.done ? "done" : ""}><i className="tick" />{c.title}
                    {c.assignee && <span className="meta">{c.assignee}</span>}
                    {c.dueDate && <span className="meta">{c.dueDate}</span>}</li>
                )) : <li className="none">No chores.</li>}
              </ul>
            </section>
            <section>
              <h3>Bills<span>{snap ? snap.bills.filter((b) => !b.paid).length : 0}</span></h3>
              <ul>
                {snap?.bills.length ? snap.bills.map((b) => (
                  <li key={b.id} className={b.paid ? "done" : ""}><i className="tick" />{b.name}
                    <span className={`meta${!b.paid && b.daysUntilDue < 0 ? " late" : ""}`}>
                      {b.paid ? "paid" : b.daysUntilDue < 0 ? `${-b.daysUntilDue}d overdue` : b.daysUntilDue === 0 ? "due today" : `in ${b.daysUntilDue}d`}
                    </span></li>
                )) : <li className="none">No bills tracked.</li>}
              </ul>
            </section>
          </div>
        </section>
        <button className="reset" onClick={reset}>Clear demo data</button>
      </aside>
    </main>
  );
}
