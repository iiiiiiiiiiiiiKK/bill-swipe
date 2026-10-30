import { DatabaseSync } from 'node:sqlite';
import { Db } from '../../src/worker/db';

/**
 * Adapter that lets the production `Db` class run against Node's built-in
 * SQLite in unit tests. This exercises the real schema, real SQL and the same
 * transaction wrapper used in production.
 */
export function createTestDb(): { db: Db; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');

  const sqlLike = {
    exec(query: string, ...params: unknown[]) {
      const trimmed = query.trim().toUpperCase();
      const isRead = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');
      if (isRead) {
        const rows = raw.prepare(query).all(...(params as never[]));
        return { toArray: () => rows };
      }
      raw.prepare(query).run(...(params as never[]));
      return { toArray: () => [] };
    },
  };

  const storage = {
    transactionSync<T>(fn: () => T): T {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          raw.exec('ROLLBACK');
        } catch {
          /* rollback failure is non-fatal in tests */
        }
        throw error;
      }
    },
  };

  const db = new Db(sqlLike as never, storage as never);
  db.migrate();
  return { db, raw };
}
