import { ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { SalesTargetIncentiveManagerPackageRepository } from "./sales-target-incentive-manager-package.repository";
import { SalesTargetIncentiveManagerPackageReadRepository } from "./sales-target-incentive-manager-package-read.repository";
import { packageFinancialReadSql, packageFinancialVersion, type PackageFinancialRow } from "./incentive-package-financial-version";
import { cycleDatabase, cycleId as id, cyclePeriod as period, seedCompanyCycle } from "./incentive-company-cycle.postgres-fixture";

// PR7's token remains a preparation/read token, not a formal company seal.
// Its old single-stage write cases are replaced by real four-stage/lock/return/GM tests
// in incentive-company-cycle.postgres.spec.ts, rather than grandfathering pending packages.
const url = process.env.INCENTIVE_PARTICIPATION_POSTGRES_URL;
const describePostgres = url ? describe : describe.skip;
jest.setTimeout(20000);
describePostgres("package financial token under company-cycle contract", () => {
  const name=`incentive_token_${randomUUID().replaceAll("-", "").slice(0,16)}`;
  let admin: Pool; let pool: Pool; let created=false;
  beforeAll(async()=>{
    admin=new Pool({connectionString:url}); await admin.query(`CREATE DATABASE ${name}`); created=true;
    const owned=new URL(url!); owned.pathname=`/${name}`; pool=new Pool({connectionString:owned.toString()});
  });
  beforeEach(async()=>seedCompanyCycle(pool));
  afterAll(async()=>{await pool?.end(); if(created) await admin.query(`DROP DATABASE ${name} WITH (FORCE)`); await admin?.end();});

  it("GET preparation summary and transaction read retain the same complete financial token",async()=>{
    const summary=(await new SalesTargetIncentiveManagerPackageReadRepository(pool as never).list({periodKey:period,companyIds:[id(1)]})).find(p=>p.package_id===id(80))!;
    const row=(await pool.query<PackageFinancialRow>(packageFinancialReadSql,[id(80)])).rows[0];
    expect(summary.frozen_total_amount).toBe("125.00");
    expect(summary.financial_version).toBe(packageFinancialVersion(period,row));
    expect(summary.store_snapshots).toEqual([expect.objectContaining({storeId:id(2),finalSnapshotId:id(30),participationRevisionNo:0,exclusions:[]})]);
  });

  it.each(["admin_approved","admin_returned"] as const)("legacy %s cannot use even a fresh PR7 token to advance pending preparation",async decision=>{
    const row=(await pool.query<PackageFinancialRow>(packageFinancialReadSql,[id(80)])).rows[0];
    const repository=new SalesTargetIncentiveManagerPackageRepository(cycleDatabase(pool) as never);
    await expect(repository.review({periodKey:period,packageId:id(80),submittedAt:null,actorUserId:id(22),companyIds:[id(1)],decision,
      reviewNote:decision==="admin_returned" ? "Use company return" : null,expectedFinancialVersion:packageFinancialVersion(period,row)!})).rejects.toBeInstanceOf(ConflictException);
    expect((await pool.query("SELECT package_status FROM ops.sales_target_incentive_region_package WHERE sales_target_incentive_region_package_id=$1::uuid",[id(80)])).rows[0].package_status).toBe("submitted");
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM ops.sales_target_incentive_adjustment")).rows[0].count).toBe(0);
  });

  it("even optional zero/empty participation metadata cannot grandfather a pending legacy endpoint",async()=>{
    const repository=new SalesTargetIncentiveManagerPackageRepository(cycleDatabase(pool) as never);
    await expect(repository.review({periodKey:period,packageId:id(80),submittedAt:null,actorUserId:id(22),companyIds:[id(1)],decision:"admin_approved",reviewNote:null})).rejects.toBeInstanceOf(ConflictException);
    await expect(pool.query("DELETE FROM ops.sales_target_incentive_region_package WHERE sales_target_incentive_region_package_id=$1::uuid",[id(80)])).rejects.toThrow("immutable");
  });
});
