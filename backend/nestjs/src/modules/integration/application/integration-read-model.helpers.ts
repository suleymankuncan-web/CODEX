export function getSupportedEntityTypes() {
  return [
    "employee",
    "store",
    "kpi",
    "assignment",
    "position",
    "company",
    "region",
  ];
}

export function getSupportedSourceSystems() {
  return ["nebim_v3", "power_bi", "manual", "other"];
}

export function getSupportedStateModels() {
  return ["latest_state", "closed_period"];
}

export function buildIntegrationLookups(
  activeSources: Array<{
    integration_source_id: string;
    source_code: string;
    source_name: string;
    entity_type: string;
    source_system: string;
    state_model: string;
  }>,
) {
  const entityTypes = getSupportedEntityTypes();
  const activeSourceOptions = activeSources.map((item) => ({
    sourceId: item.integration_source_id,
    sourceCode: item.source_code,
    sourceName: item.source_name,
    entityType: item.entity_type,
    sourceSystem: item.source_system,
    stateModel: item.state_model,
  }));
  const sourcesByEntityType = activeSources.reduce<
    Record<
      string,
      Array<{ sourceId: string; sourceCode: string; sourceName: string }>
    >
  >((acc, item) => {
    if (!acc[item.entity_type]) {
      acc[item.entity_type] = [];
    }

    acc[item.entity_type].push({
      sourceId: item.integration_source_id,
      sourceCode: item.source_code,
      sourceName: item.source_name,
    });

    return acc;
  }, {});

  return {
    entityTypes,
    sourceStats: {
      totalActiveSources: activeSources.length,
    },
    activeSources: activeSourceOptions,
    sourcesByEntityType,
    optionGroups: {
      entityTypes: entityTypes.map((entityType) => ({
        value: entityType,
        label: entityType,
      })),
      sources: activeSourceOptions.map((item) => ({
        value: item.sourceId,
        label: `${item.sourceCode} - ${item.sourceName}`,
        entityType: item.entityType,
        sourceCode: item.sourceCode,
        sourceSystem: item.sourceSystem,
        stateModel: item.stateModel,
      })),
      sourceSystems: getSupportedSourceSystems().map((sourceSystem) => ({
        value: sourceSystem,
        label: sourceSystem,
      })),
      stateModels: getSupportedStateModels().map((stateModel) => ({
        value: stateModel,
        label: stateModel,
      })),
    },
    meta: {
      totalEntityTypes: entityTypes.length,
      totalActiveSources: activeSourceOptions.length,
    },
  };
}

export function mapIntegrationSource(item: {
  integration_source_id: string;
  source_code: string;
  source_name: string;
  entity_type: string;
  source_system: string;
  state_model: string;
  poll_enabled: boolean;
  poll_interval_minutes: number;
  poll_window_start_local: string;
  poll_window_end_local: string;
  poll_timezone: string;
  is_active: boolean;
}) {
  return {
    sourceId: item.integration_source_id,
    sourceCode: item.source_code,
    sourceName: item.source_name,
    entityType: item.entity_type,
    sourceSystem: item.source_system,
    stateModel: item.state_model,
    pollEnabled: item.poll_enabled,
    pollIntervalMinutes: item.poll_interval_minutes,
    pollWindowStartLocal: item.poll_window_start_local,
    pollWindowEndLocal: item.poll_window_end_local,
    pollTimezone: item.poll_timezone,
    isActive: item.is_active,
  };
}

export function mapStoreMaster(item: {
  store_id: string;
  store_code: string;
  store_name: string;
  store_type: string;
  status: string;
  kpi_import_enabled: boolean;
  region_id: string | null;
  region_name: string | null;
}) {
  return {
    storeId: item.store_id,
    storeCode: item.store_code,
    storeName: item.store_name,
    storeType: item.store_type,
    status: item.status,
    kpiImportEnabled: item.kpi_import_enabled,
    regionId: item.region_id,
    regionName: item.region_name,
  };
}

export function mapPersonnelMaster(item: {
  employee_id: string;
  external_employee_ref: string | null;
  first_name: string;
  last_name: string;
  hire_date: string;
  termination_date: string | null;
  employment_status: string;
  employment_type: string;
  assignment_id: string | null;
  assignment_start_date: string | null;
  store_id: string | null;
  store_code: string | null;
  store_name: string | null;
  region_id: string | null;
  region_name: string | null;
  position_id: string | null;
  position_code: string | null;
  position_name: string | null;
}) {
  const firstName = item.first_name.trim();
  const lastName = item.last_name.trim();

  return {
    employeeId: item.employee_id,
    externalEmployeeRef: item.external_employee_ref,
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(" "),
    hireDate: item.hire_date,
    terminationDate: item.termination_date,
    employmentStatus: item.employment_status,
    employmentType: item.employment_type,
    assignmentId: item.assignment_id,
    assignmentStartDate: item.assignment_start_date,
    storeId: item.store_id,
    storeCode: item.store_code,
    storeName: item.store_name,
    regionId: item.region_id,
    regionName: item.region_name,
    positionId: item.position_id,
    positionCode: item.position_code,
    positionName: item.position_name,
  };
}
