import { IntegrationRepository } from "./integration.repository";

describe("IntegrationRepository store contact emails", () => {
  it("deactivates the old set before atomically upserting the submitted addresses", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new IntegrationRepository({} as never, {} as never, {} as never, {} as never);

    await (repository as unknown as {
      syncStoreContactEmails: (client: { query: typeof query }, input: unknown) => Promise<void>;
    }).syncStoreContactEmails({ query }, {
      companyId: "company-1",
      storeId: "store-1",
      emails: [
        { emailAddress: "primary@example.com", label: "Main", isPrimary: true },
        { emailAddress: "ops@example.com", label: "Operations", isPrimary: false },
      ],
    });

    expect(String(query.mock.calls[0][0])).toContain("is_active = FALSE");
    expect(query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO ops.store_contact_email"))).toHaveLength(2);
    expect(query.mock.calls[1][1]).toEqual(["company-1", "store-1", "primary@example.com", "Main", true]);
  });

  it("reloads contact and ingest evidence inside the command transaction", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ active_source_count: 2, matched_source_count: 2, last_successful_kpi_date: "2026-09-28", region_manager_user_id: "manager-1", region_manager_name: "Manager One" }] })
      .mockResolvedValueOnce({ rows: [{ emailAddress: "store@example.com", label: "Main", isPrimary: true }] });
    const repository = new IntegrationRepository({} as never, {} as never, {} as never, {} as never);
    const result = await (repository as unknown as {
      enrichStoreCommandRow: (client: { query: typeof query }, store: unknown) => Promise<Record<string, unknown>>;
    }).enrichStoreCommandRow({ query }, { store_id: "store-1", status: "active", kpi_import_enabled: true });

    expect(result).toEqual(expect.objectContaining({
      contact_emails: [{ emailAddress: "store@example.com", label: "Main", isPrimary: true }],
      ingest_status: "ready",
      matched_source_count: 2,
      active_source_count: 2,
      last_successful_kpi_date: "2026-09-28",
      region_manager_user_id: "manager-1",
      region_manager_name: "Manager One",
    }));
  });
});
