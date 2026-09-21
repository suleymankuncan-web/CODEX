import { PersonnelMasterReadRepository } from "./personnel-master-read.repository";

describe("PersonnelMasterReadRepository", () => {
  it("derives account status only for the paginated personnel query", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ total_count: "1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new PersonnelMasterReadRepository({ query } as never);

    await repository.listPersonnelMaster({ actorCompanyIds: ["company-1"] });

    const countSql = query.mock.calls[0]?.[0] as string;
    const listSql = query.mock.calls[1]?.[0] as string;
    expect(countSql).not.toContain("ops.user_account");
    expect(listSql).toContain("LEFT JOIN LATERAL");
    expect(listSql).toContain("FROM ops.user_account ua");
    expect(listSql).toContain("WHEN account.identity_status = 'failed' THEN 'failed'");
    expect(listSql).toContain("WHEN account.is_active = FALSE THEN 'inactive'");
    expect(listSql).toContain("ELSE 'active'");
  });
});
