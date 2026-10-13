/**
 * Storage layer.
 *
 * - With DATABASE_URL set  -> Neon serverless Postgres (works on Vercel, free tier).
 * - Without it             -> in-memory (great for local dev; resets on every cold start,
 *                             so do NOT rely on it once deployed to Vercel).
 *
 * Everything is stored as one generic table so adding a new kind of item
 * (e.g. "pets", "medications") needs zero migrations.
 */
import { neon } from "@neondatabase/serverless";

export type Kind = "grocery" | "chore" | "bill";

export interface Item<T = Record<string, unknown>> {
  id: string;
  kind: Kind;
  data: T;
  createdAt: string;
}

export interface Store {
  readonly backend: "neon" | "memory";
  list(kind: Kind): Promise<Item[]>;
  add(kind: Kind, data: Record<string, unknown>): Promise<Item>;
  update(kind: Kind, id: string, patch: Record<string, unknown>): Promise<Item | null>;
  remove(kind: Kind, id: string): Promise<boolean>;
}

const newId = (kind: Kind) =>
  `${kind.slice(0, 2)}_${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------ memory ------------------------------ */

class MemoryStore implements Store {
  readonly backend = "memory" as const;
  private rows: Item[] = [];

  async list(kind: Kind) {
    return this.rows.filter((r) => r.kind === kind);
  }
  async add(kind: Kind, data: Record<string, unknown>) {
    const item: Item = { id: newId(kind), kind, data, createdAt: new Date().toISOString() };
    this.rows.push(item);
    return item;
  }
  async update(kind: Kind, id: string, patch: Record<string, unknown>) {
    const row = this.rows.find((r) => r.kind === kind && r.id === id);
    if (!row) return null;
    row.data = { ...row.data, ...patch };
    return row;
  }
  async remove(kind: Kind, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.kind === kind && r.id === id));
    return this.rows.length < before;
  }
}

/* ------------------------------- neon ------------------------------- */

class NeonStore implements Store {
  readonly backend = "neon" as const;
  private sql: ReturnType<typeof neon>;
  private ready: Promise<void> | null = null;

  constructor(url: string) {
    this.sql = neon(url);
  }

  private init() {
    this.ready ??= this.sql`
      CREATE TABLE IF NOT EXISTS household_items (
        id         TEXT PRIMARY KEY,
        kind       TEXT NOT NULL,
        data       JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `.then(() => undefined);
    return this.ready;
  }

  private map(r: Record<string, unknown>): Item {
    return {
      id: r.id as string,
      kind: r.kind as Kind,
      data: r.data as Record<string, unknown>,
      createdAt: new Date(r.created_at as string).toISOString(),
    };
  }

  async list(kind: Kind) {
    await this.init();
    const rows = (await this.sql`
      SELECT * FROM household_items WHERE kind = ${kind} ORDER BY created_at ASC
    `) as Record<string, unknown>[];
    return rows.map((r) => this.map(r));
  }
  async add(kind: Kind, data: Record<string, unknown>) {
    await this.init();
    const id = newId(kind);
    const rows = (await this.sql`
      INSERT INTO household_items (id, kind, data)
      VALUES (${id}, ${kind}, ${JSON.stringify(data)}::jsonb)
      RETURNING *
    `) as Record<string, unknown>[];
    return this.map(rows[0]);
  }
  async update(kind: Kind, id: string, patch: Record<string, unknown>) {
    await this.init();
    const rows = (await this.sql`
      UPDATE household_items
      SET data = data || ${JSON.stringify(patch)}::jsonb
      WHERE kind = ${kind} AND id = ${id}
      RETURNING *
    `) as Record<string, unknown>[];
    return rows[0] ? this.map(rows[0]) : null;
  }
  async remove(kind: Kind, id: string) {
    await this.init();
    const rows = (await this.sql`
      DELETE FROM household_items WHERE kind = ${kind} AND id = ${id} RETURNING id
    `) as Record<string, unknown>[];
    return rows.length > 0;
  }
}

/* ----------------------------- singleton ---------------------------- */

const g = globalThis as unknown as { __hearthStore?: Store };

export function getStore(): Store {
  if (!g.__hearthStore) {
    const url = process.env.DATABASE_URL;
    g.__hearthStore = url ? new NeonStore(url) : new MemoryStore();
  }
  return g.__hearthStore;
}
