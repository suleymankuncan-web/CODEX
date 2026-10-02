import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { WorkforceLookupReadRepository } from "./workforce-lookup-read.repository";

const container = process.env.RANKING_RANGE_POSTGRES_CONTAINER;
const describePg = container ? describe : describe.skip;
describePg("franchise code history in an owned disposable PostgreSQL database", () => {
  const name = `seller_history_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  let created = false;
  const psql = (sql: string, db = name) => execFileSync("docker", ["exec", "-i", container!, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", db, "-Atq"], { input: sql, encoding: "utf8" }).trim();
  beforeAll(() => {
    psql(`CREATE DATABASE ${name}`, "postgres"); created = true;
    psql(`CREATE SCHEMA ops; CREATE TABLE ops.employee(external_employee_ref text);
      CREATE TABLE ops.seller_code_request(approved_seller_code text, request_status text);
      INSERT INTO ops.employee SELECT 'FM'||n FROM generate_series(1,12) n;
      INSERT INTO ops.employee VALUES ('fm12'),('LP123'),('FMnotnumeric'),('FM922337203685477580899');
      INSERT INTO ops.seller_code_request VALUES ('FM12','approved'),('FM100','approved'),('FM999999','pending_hr_approval');`);
  });
  afterAll(() => { if (created) psql(`DROP DATABASE ${name} WITH (FORCE)`, "postgres"); });
  it("deduplicates all sources, excludes pending codes and sorts without integer precision loss", async () => {
    const repository = new WorkforceLookupReadRepository({ query: async (sql: string, values: number[]) => {
      const substituted = sql.replace("$1", String(values[0]));
      return { rows: JSON.parse(psql(`SELECT COALESCE(json_agg(row), '[]'::json) FROM (${substituted}) row`)) };
    } } as never);
    const expected = ["FM922337203685477580899", "FM100", "FM12", "FM11", "FM10", "FM9", "FM8", "FM7", "FM6", "FM5"];
    await expect(repository.getRecentFranchiseSellerCodes()).resolves.toEqual(expected);
    await expect(repository.getLatestFranchiseSellerCode()).resolves.toBe(expected[0]);
    psql("TRUNCATE ops.employee,ops.seller_code_request");
    await expect(repository.getRecentFranchiseSellerCodes()).resolves.toEqual([]);
    await expect(repository.getLatestFranchiseSellerCode()).resolves.toBeNull();
  });
});
