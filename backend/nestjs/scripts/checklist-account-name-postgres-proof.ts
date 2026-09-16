import { strict as assert } from "node:assert";
import type { Pool } from "pg";
import { DatabaseService } from "../src/shared/database/database.service";
import { ChecklistAcknowledgementRepository } from "../src/modules/store-ops/infrastructure/checklist-acknowledgement.repository";
import { ChecklistOperationalHistoryRepository } from "../src/modules/store-ops/infrastructure/checklist-operational-history.repository";

// Called only after the parent smoke verifies a local disposable database.
export async function verifyChecklistAccountNames(pool: Pool, input: {
  companyId: string; storeId: string; otherStoreId: string;
  actorUserId: string; checklistInstanceId: string;
}) {
  const database = new DatabaseService(pool);
  const results = new ChecklistAcknowledgementRepository(database);
  const history = new ChecklistOperationalHistoryRepository(database);
  const resultInput = {
    companyIds: [], regionIds: [], storeIds: [input.storeId],
    checklistInstanceId: input.checklistInstanceId, includeResponses: true,
  };
  const readResult = () => results.listChecklistAcknowledgements(resultInput);
  const readActor = async () => (await history.read({
    companyIds: [], regionIds: [], storeIds: [input.storeId], storeId: input.storeId,
    range: "all", kinds: ["checklist_completed"], cursor: null, limit: 21,
  }))?.items[0]?.event.actorSnapshot;

  const role = await pool.query<{ user_role_assignment_id: string }>(`
    INSERT INTO ops.user_role_assignment (user_id, role_id, scope_type, company_id, start_at)
    SELECT $1, role_id, 'company', $2, '2020-01-01' FROM ops.role WHERE role_code = 'REGION_MANAGER'
    RETURNING user_role_assignment_id`, [input.actorUserId, input.companyId]);
  assert.equal(role.rowCount, 1);
  await pool.query(`INSERT INTO ops.user_action_store_assignment (user_id, store_id, start_at)
    VALUES ($1, $2, '2020-01-01')`, [input.actorUserId, input.storeId]);

  assert.equal((await readActor())?.displayName, "History Actor");
  assert.deepEqual((await readResult()).items[0]?.signatories?.regionManagerNames, ["History Actor"]);

  await pool.query(`UPDATE ops.user_account SET employee_id = NULL, username = 'Ece Örnek' WHERE user_id = $1`, [input.actorUserId]);
  assert.deepEqual(await readActor(), {
    displayName: "Ece Örnek", roleLabel: "Store Role", assignmentLabel: "History Store",
    identityStatus: "historical_projection",
  });
  const accountOnlyResult = (await readResult()).items[0];
  assert.equal(accountOnlyResult?.completedByDisplayName, "Ece Örnek");
  assert.deepEqual(accountOnlyResult?.signatories?.regionManagerNames, ["Ece Örnek"]);
  assert.equal((await results.listChecklistAcknowledgements({ ...resultInput, storeIds: [input.otherStoreId] })).items.length, 0);

  await pool.query(`UPDATE ops.user_account SET is_active = FALSE WHERE user_id = $1`, [input.actorUserId]);
  assert.deepEqual((await readResult()).items[0]?.signatories?.regionManagerNames, []);
  assert.equal((await readActor())?.displayName, "Ece Örnek", "historical actors remain identifiable after account deactivation");

  await pool.query(`UPDATE ops.user_account SET is_active = TRUE WHERE user_id = $1`, [input.actorUserId]);
  await pool.query(`UPDATE ops.user_action_store_assignment SET end_at = '2021-01-01' WHERE user_id = $1 AND store_id = $2`, [input.actorUserId, input.storeId]);
  assert.deepEqual((await readResult()).items[0]?.signatories?.regionManagerNames, []);
  await pool.query(`UPDATE ops.user_action_store_assignment SET end_at = NULL WHERE user_id = $1 AND store_id = $2`, [input.actorUserId, input.storeId]);
  await pool.query(`UPDATE ops.user_role_assignment SET end_at = '2021-01-01' WHERE user_role_assignment_id = $1`, [role.rows[0].user_role_assignment_id]);
  assert.deepEqual((await readResult()).items[0]?.signatories?.regionManagerNames, []);
  await pool.query(`UPDATE ops.user_role_assignment SET end_at = NULL WHERE user_role_assignment_id = $1`, [role.rows[0].user_role_assignment_id]);

  await pool.query(`UPDATE ops.user_account SET username = '   ' WHERE user_id = $1`, [input.actorUserId]);
  assert.equal((await readActor())?.displayName, null, "blank names must not disclose the account email");
  assert.deepEqual((await readResult()).items[0]?.signatories?.regionManagerNames, []);
}
