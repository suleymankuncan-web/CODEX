import { WorkforceLookupReadRepository } from "./workforce-lookup-read.repository";
import {
  createRepositoryQueryMock,
  getExecutedQuery,
} from "./repository-test-helpers";

describe("WorkforceLookupReadRepository", () => {
  it("orders numeric seller-code suffixes without overflowing PostgreSQL integer", async () => {
    const query = createRepositoryQueryMock([{ seller_code: "FM9260908140111" }]);
    const repository = new WorkforceLookupReadRepository({ query } as never);

    await expect(repository.getLatestFranchiseSellerCode()).resolves.toBe(
      "FM9260908140111",
    );

    const executed = getExecutedQuery(query);
    expect(executed.sql).toContain("SUBSTRING(seller_code FROM 3)::bigint DESC");
    expect(executed.sql).not.toContain("SUBSTRING(seller_code FROM 3)::integer DESC");
  });

  it("uses employee hire date as the store workforce start-date fallback", async () => {
    const query = createRepositoryQueryMock();
    const repository = new WorkforceLookupReadRepository({ query } as never);

    await repository.listActiveStoreEmployees({
      storeId: "00000000-0000-0000-0000-000000000100",
    });

    const executed = getExecutedQuery(query);
    expect(executed.sql).toContain(
      "COALESCE(eah.start_date, e.hire_date)::text AS assignment_start_date",
    );
    expect(executed.params).toEqual([
      "00000000-0000-0000-0000-000000000100",
    ]);
  });

  it("uses the same start-date fallback for offboarding employee lookups", async () => {
    const query = createRepositoryQueryMock();
    const repository = new WorkforceLookupReadRepository({ query } as never);

    await repository.getActiveStoreEmployeeForOffboarding({
      storeId: "00000000-0000-0000-0000-000000000100",
      employeeId: "00000000-0000-0000-0000-000000000202",
    });

    const executed = getExecutedQuery(query);
    expect(executed.sql).toContain(
      "COALESCE(eah.start_date, e.hire_date)::text AS assignment_start_date",
    );
    expect(executed.params).toEqual([
      "00000000-0000-0000-0000-000000000100",
      "00000000-0000-0000-0000-000000000202",
    ]);
  });
});
