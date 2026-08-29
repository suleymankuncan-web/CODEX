import {
  getSupportedEntityTypes,
  getSupportedSourceSystems,
  getSupportedStateModels,
  mapIntegrationSource,
  mapPersonnelMaster,
  mapStoreMaster,
} from "./integration-read-model.helpers";

describe("integration read model helpers", () => {
  it("keeps supported lookup option lists stable", () => {
    expect(getSupportedEntityTypes()).toEqual([
      "employee",
      "store",
      "kpi",
      "assignment",
      "position",
      "company",
      "region",
    ]);
    expect(getSupportedSourceSystems()).toEqual([
      "nebim_v3",
      "power_bi",
      "manual",
      "other",
    ]);
    expect(getSupportedStateModels()).toEqual(["latest_state", "closed_period"]);
  });

  it("maps integration source rows to API read models", () => {
    expect(
      mapIntegrationSource({
        integration_source_id: "source-1",
        source_code: "POWER_BI",
        source_name: "Power BI",
        entity_type: "kpi",
        source_system: "power_bi",
        state_model: "closed_period",
        poll_enabled: true,
        poll_interval_minutes: 60,
        poll_window_start_local: "08:00",
        poll_window_end_local: "18:00",
        poll_timezone: "Europe/Istanbul",
        is_active: true,
      }),
    ).toEqual({
      sourceId: "source-1",
      sourceCode: "POWER_BI",
      sourceName: "Power BI",
      entityType: "kpi",
      sourceSystem: "power_bi",
      stateModel: "closed_period",
      pollEnabled: true,
      pollIntervalMinutes: 60,
      pollWindowStartLocal: "08:00",
      pollWindowEndLocal: "18:00",
      pollTimezone: "Europe/Istanbul",
      isActive: true,
    });
  });

  it("maps store master rows to API read models", () => {
    expect(
      mapStoreMaster({
        store_id: "store-1",
        store_code: "SM140",
        store_name: "Marmara Park",
        store_type: "company",
        status: "active",
        kpi_import_enabled: true,
        region_id: "region-1",
        region_name: "Marmara",
        updated_at: "2026-06-30T10:00:00.000Z",
      }),
    ).toEqual({
      storeId: "store-1",
      storeCode: "SM140",
      storeName: "Marmara Park",
      storeType: "company",
      status: "active",
      kpiImportEnabled: true,
      regionId: "region-1",
      regionName: "Marmara",
      regionManagerUserId: null,
      regionManagerName: null,
      updatedAt: "2026-06-30T10:00:00.000Z",
    });
  });

  it("maps personnel master rows and preserves display-name trimming", () => {
    expect(
      mapPersonnelMaster({
        employee_id: "employee-1",
        external_employee_ref: "FM8375",
        first_name: " Ada ",
        last_name: " Lovelace ",
        national_id_last4: "8901",
        phone_number: "+90 555 111 22 33",
        hire_date: "2026-01-01",
        termination_date: null,
        employment_status: "active",
        employment_type: "full_time",
        assignment_id: "assignment-1",
        assignment_start_date: "2026-01-02",
        store_id: "store-1",
        store_code: "SM140",
        store_name: "Marmara Park",
        region_id: "region-1",
        region_name: "Marmara",
        position_id: "position-1",
        position_code: "SALES",
        position_name: "Sales Consultant",
        updated_at: "2026-06-30T10:00:00.000Z",
      }),
    ).toEqual({
      employeeId: "employee-1",
      externalEmployeeRef: "FM8375",
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada Lovelace",
      nationalIdLast4: "8901",
      phoneNumber: "+90 555 111 22 33",
      hireDate: "2026-01-01",
      terminationDate: null,
      employmentStatus: "active",
      employmentType: "full_time",
      assignmentId: "assignment-1",
      assignmentStartDate: "2026-01-02",
      storeId: "store-1",
      storeCode: "SM140",
      storeName: "Marmara Park",
      regionId: "region-1",
      regionName: "Marmara",
      positionId: "position-1",
      positionCode: "SALES",
      positionName: "Sales Consultant",
      updatedAt: "2026-06-30T10:00:00.000Z",
    });
  });
});
