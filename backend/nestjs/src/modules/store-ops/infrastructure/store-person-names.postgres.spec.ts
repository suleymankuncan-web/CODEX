import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { cycleDatabase, cycleId as id, seedCompanyCycle } from "./incentive-company-cycle.postgres-fixture";
import { ChecklistAcknowledgementRepository } from "./checklist-acknowledgement.repository";
import { ChecklistCommandReadRepository } from "./checklist-command-read.repository";
import { SalesTargetIncentiveWorkspaceReadRepository } from "./sales-target-incentive-workspace-read.repository";

const url = process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePg = url ? describe : describe.skip;
describePg("Store account display names on the production PostgreSQL schema", () => {
  const name = `store_names_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  let admin: Pool, pool: Pool;
  const database = () => cycleDatabase(pool) as never;
  beforeAll(async () => {
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE DATABASE "${name}"`);
    const connection = new URL(url!); connection.pathname = `/${name}`;
    pool = new Pool({ connectionString: connection.href });
    await seedCompanyCycle(pool);
    await pool.query(`UPDATE ops.user_account SET username='onurkaytan',first_name='Onur',last_name='Kaytan' WHERE user_id='${id(20)}';
      INSERT INTO ops.checklist_template(checklist_template_id,company_id,template_code,template_type,template_name,category,version_no,effective_from,created_by)
        VALUES('${id(80)}','${id(1)}','NAME-FIXTURE','BM_STORE_VISIT','Synthetic checklist','BM',1,'2020-01-01','${id(20)}');
      INSERT INTO ops.checklist_instance(checklist_instance_id,checklist_template_id,store_id,auditor_employee_id,completed_by_user_id,completed_at,status,total_score)
        VALUES('${id(81)}','${id(80)}','${id(2)}','${id(10)}','${id(20)}','2026-09-15T12:00Z','completed',80);`);
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) { await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`); await admin.end(); }
  });
  it("attributes a completed checklist to the named completing account before another auditor", async () => {
    const result = await new ChecklistAcknowledgementRepository(database()).listChecklistAcknowledgements({
      companyIds: [id(1)], regionIds: [], storeIds: [id(2)], checklistInstanceId: id(81), includeResponses: true,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].completedByDisplayName).toBe("Onur Kaytan");
    expect(result.items[0].signatories?.regionManagerNames).toEqual(["Onur Kaytan"]);
  });
  it("uses the same manager account name in checklist rows, manager rows and incentive metadata", async () => {
    const commands = new ChecklistCommandReadRepository(database());
    const stores = await commands.list({ companyIds: [id(1)], regionIds: [], storeIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT"], executionTemplateTypes: ["BM_STORE_VISIT"], period: "2026-09", status: "all", sort: "last_visit_desc", limit: 20, offset: 0 });
    expect(stores.items.find(item => item.storeId === id(2))?.regionManagers).toEqual([{ displayName: "Onur Kaytan" }]);
    const managers = await commands.listRegions({ companyIds: [id(1)], period: "2026-09", signal: "all", sort: "manager_asc", limit: 20, offset: 0 });
    expect(JSON.stringify(managers.items)).toContain("Onur Kaytan");
    expect(JSON.stringify(managers.items)).not.toContain("onurkaytan");
    const metadata = await new SalesTargetIncentiveWorkspaceReadRepository(database()).listStoreMetadata({ storeIds: [id(2)], periodEnd: "2026-09-30" });
    expect(metadata[0]).toMatchObject({ region_manager_user_id: id(20), region_manager_name: "Onur Kaytan" });
    await pool.query(`INSERT INTO ops.user_action_store_assignment(user_id,store_id,start_at) VALUES('${id(21)}','${id(2)}','2020-01-01');`);
    const ambiguous = await new SalesTargetIncentiveWorkspaceReadRepository(database()).listStoreMetadata({ storeIds: [id(2)], periodEnd: "2026-09-30" });
    expect(ambiguous[0]).toMatchObject({ region_manager_user_id: null, region_manager_name: null });
  });
  it("keeps a known nameless completing account distinct from a different named auditor", async () => {
    await pool.query(`UPDATE ops.user_account SET first_name=NULL,last_name=NULL WHERE user_id='${id(20)}'`);
    const result = await new ChecklistAcknowledgementRepository(database()).listChecklistAcknowledgements({
      companyIds: [id(1)], regionIds: [], storeIds: [id(2)], checklistInstanceId: id(81), includeResponses: true,
    });
    expect(result.items[0].completedByDisplayName).toBe("Kullanıcı");
    expect(result.items[0].completedByDisplayName).not.toBe("Included One");
    expect(result.items[0].completedByDisplayName).not.toBe("onurkaytan");
  });

});
