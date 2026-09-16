import { createHash } from "node:crypto";
import type { DatabaseService } from "../../../shared/database/database.service";

/**
 * Conservative read-only invalidation. Equal MVCC snapshots have the same visible
 * committed transactions. Unrelated writes can cause misses, never stale hits.
 * Used only for physical facts: no NOW(), permissions or user-specific results.
 * Do not use a transaction-local client (own uncommitted writes are not in xip).
 */
export async function readRankingFactsRevision(database: DatabaseService, databaseUrl: string) {
  const result = await database.query<{ database_name: string; database_user: string; server_started_at: string; revision: string }>(`
    SELECT current_database() AS database_name, current_user AS database_user,
      pg_postmaster_start_time()::text AS server_started_at,
      pg_current_snapshot()::text AS revision
  `);
  const row = result.rows[0];
  if (!row) return undefined;
  const endpoint = new URL(databaseUrl);
  // Neither credentials nor connection strings go to Redis or logs.
  const namespace = createHash("sha256").update(JSON.stringify([
    endpoint.host, row.database_name, row.database_user, row.server_started_at,
  ])).digest("hex");
  return { namespace, snapshot: row.revision, revision: createHash("sha256").update(row.revision).digest("hex") };
}
