import type { SqlStorage } from '@cloudflare/workers-types';
import { SCHEMA_STATEMENTS, SCHEMA_VERSION } from './schema';

/** Minimal surface of DurableObjectStorage that we depend on. */
export interface DurableObjectTransactionHost {
  transactionSync<T>(fn: () => T): T;
}

/**
 * Thin query layer over the Durable Object SQLite storage.
 *
 * Multi-statement writes that must be atomic go through `transaction()`, which
 * delegates to the Durable Object storage transaction API (the supported way to
 * get rollback inside a Durable Object). The object is single-writer, so all
 * business writes are serialized.
 */
export class Db {
  constructor(
    private readonly sql: SqlStorage,
    private readonly storage?: DurableObjectTransactionHost,
  ) {}

  migrate(): void {
    for (const statement of SCHEMA_STATEMENTS) {
      this.sql.exec(statement);
    }
    this.sql.exec(
      `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      String(SCHEMA_VERSION),
    );
  }

  all<T = Record<string, unknown>>(query: string, ...params: unknown[]): T[] {
    return this.sql.exec(query, ...params).toArray() as unknown as T[];
  }

  first<T = Record<string, unknown>>(query: string, ...params: unknown[]): T | null {
    const rows = this.all<T>(query, ...params);
    return rows.length > 0 ? rows[0]! : null;
  }

  run(query: string, ...params: unknown[]): void {
    this.sql.exec(query, ...params);
  }

  /** Execute `fn` inside a write transaction. Rolls back on throw. */
  transaction<T>(fn: () => T): T {
    if (this.storage) return this.storage.transactionSync(fn);
    return fn();
  }

  getMeta(key: string): string | null {
    return this.first<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.run(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value,
    );
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
