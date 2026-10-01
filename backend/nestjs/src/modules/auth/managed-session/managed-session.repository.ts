import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";

export interface ManagedSessionRow {
  session_id: string;
  login_fingerprint: string;
  status: "creating" | "active" | "revoked";
  user_id: string | null;
  issuer: string | null;
  subject: string | null;
  refresh_ciphertext: string | null;
  access_expires_at: Date | null;
  refreshed_at: Date;
  created_at: Date;
  expires_at: Date;
}

interface ManagedSessionAuthorizationRow extends ManagedSessionRow {
  account_active: boolean | null;
  account_provider: string | null;
  account_subject: string | null;
}

@Injectable()
export class ManagedSessionRepository {
  constructor(private readonly database: DatabaseService) {}

  async claim(sessionId: string, fingerprint: string, ttl: number) {
    const inserted = await this.database.query<ManagedSessionRow>(`
      INSERT INTO ops.managed_browser_session(session_id,login_fingerprint,status,expires_at)
      VALUES ($1,$2,'creating',NOW()+$3::int * INTERVAL '1 second')
      ON CONFLICT (login_fingerprint) DO NOTHING RETURNING *`, [sessionId, fingerprint, ttl]);
    if (inserted.rows[0]) return { row: inserted.rows[0], owned: true };
    const existing = await this.database.query<ManagedSessionRow>(
      "SELECT * FROM ops.managed_browser_session WHERE login_fingerprint=$1", [fingerprint]);
    return { row: existing.rows[0], owned: false };
  }

  async activate(sessionId: string, userId: string, issuer: string, subject: string,
    ciphertext: string, accessExpiresAt: number, providerKey = "oidc") {
    const result = await this.database.query<ManagedSessionRow>(`
      WITH activated AS (UPDATE ops.managed_browser_session SET status='active',user_id=$2,issuer=$3,subject=$4,
        refresh_ciphertext=$5,access_expires_at=to_timestamp($6),refreshed_at=clock_timestamp()
      WHERE session_id=$1 AND status='creating' AND expires_at>NOW()
        AND EXISTS(SELECT 1 FROM ops.user_account WHERE user_id=$2::uuid AND is_active
          AND auth_provider=$7 AND provider_subject=$4) RETURNING *),
      recorded AS (UPDATE ops.user_account SET last_login_at=GREATEST(last_login_at,clock_timestamp())
        WHERE user_id=$2::uuid AND EXISTS(SELECT 1 FROM activated) RETURNING user_id)
      SELECT * FROM activated`,
    [sessionId, userId, issuer, subject, ciphertext, accessExpiresAt, providerKey]);
    return result.rows[0];
  }

  async withLocked<T>(sessionId: string, work: (row: ManagedSessionAuthorizationRow | undefined,
    client: PoolClient) => Promise<T>) {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout='5000ms'");
      await client.query("SET LOCAL statement_timeout='12000ms'");
      const result = await client.query<ManagedSessionAuthorizationRow>(
        `SELECT session.*,account.is_active AS account_active,account.auth_provider AS account_provider,
          account.provider_subject AS account_subject FROM ops.managed_browser_session session
          LEFT JOIN ops.user_account account ON account.user_id=session.user_id
          WHERE session.session_id=$1 FOR UPDATE OF session`, [sessionId]);
      return work(result.rows[0], client);
    });
  }

  async revoke(sessionId: string) {
    const result = await this.database.query<ManagedSessionRow>(`
      UPDATE ops.managed_browser_session SET status='revoked',refresh_ciphertext=NULL
      WHERE session_id=$1 RETURNING *`, [sessionId]);
    return result.rows[0];
  }

  async purgeExpired() {
    await this.database.query(`DELETE FROM ops.managed_browser_session WHERE session_id IN (
      SELECT session_id FROM ops.managed_browser_session WHERE expires_at<NOW()
        OR (status<>'active' AND created_at<NOW()-INTERVAL '15 minutes')
      ORDER BY expires_at LIMIT 500 FOR UPDATE SKIP LOCKED)`);
  }
}
