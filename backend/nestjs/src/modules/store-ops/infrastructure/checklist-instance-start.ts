import { BadRequestException } from "@nestjs/common";
import type { PoolClient } from "pg";

type StartChecklistInput = {
  checklistTemplateId: string;
  storeId: string;
  actorUserId: string;
};

export async function startOrResumeChecklistInstance(
  client: PoolClient,
  input: StartChecklistInput,
) {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2)::bigint)`,
    [input.checklistTemplateId, input.storeId],
  );
  const existing = await client.query<{
    checklist_instance_id: string;
    status: string;
    created_at: string;
  }>(
    `
      SELECT checklist_instance_id, status, created_at
      FROM ops.checklist_instance
      WHERE checklist_template_id = $1::uuid
        AND store_id = $2::uuid
        AND status IN ('planned', 'in_progress')
      ORDER BY COALESCE(started_at, created_at) DESC, checklist_instance_id DESC
      LIMIT 1
    `,
    [input.checklistTemplateId, input.storeId],
  );
  if (existing.rows[0]) return existing.rows[0];

  const created = await client.query<{
    checklist_instance_id: string;
    status: string;
    created_at: string;
  }>(
    `
      INSERT INTO ops.checklist_instance (
        checklist_template_id, store_id, started_by_user_id, started_at, status
      )
      SELECT ct.checklist_template_id, s.store_id, $3, NOW(), 'in_progress'
      FROM ops.checklist_template ct
      INNER JOIN ops.store s
        ON s.store_id = $2::uuid
       AND s.company_id = ct.company_id
      WHERE ct.checklist_template_id = $1::uuid
        AND ct.status = 'published'
        AND ct.effective_from <= CURRENT_DATE
        AND (ct.effective_to IS NULL OR ct.effective_to >= CURRENT_DATE)
      RETURNING checklist_instance_id, status, created_at
    `,
    [input.checklistTemplateId, input.storeId, input.actorUserId],
  );
  if (!created.rows[0]) {
    throw new BadRequestException("Checklist template is not available for this store");
  }
  return created.rows[0];
}
