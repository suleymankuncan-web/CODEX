export const storeMasterLookupsSchema = {
  type: "object",
  required: ["storeTypes", "statuses", "regions", "regionManagers"],
  properties: {
    storeTypes: enumLookup(["company", "franchise", "operator"]),
    statuses: enumLookup(["active", "inactive", "closed"]),
    regions: {
      type: "array",
      items: {
        type: "object",
        required: ["regionId", "regionCode", "regionName"],
        properties: stringProperties(["regionId", "regionCode", "regionName"]),
      },
    },
    regionManagers: {
      type: "array",
      items: {
        type: "object",
        required: [
          "assignmentId", "userId", "displayName", "email", "regionId", "regionCode", "regionName",
        ],
        properties: stringProperties([
          "assignmentId", "userId", "displayName", "email", "regionId", "regionCode", "regionName",
        ]),
      },
    },
  },
};

export const storeMasterItemSchema = {
  type: "object",
  required: [
    "storeId", "storeCode", "storeName", "storeType", "status", "kpiImportEnabled", "regionId",
    "regionName", "regionManagerUserId", "regionManagerName", "contactEmails", "ingestStatus",
    "matchedSourceCount", "activeSourceCount", "lastSuccessfulKpiDate", "updatedAt",
  ],
  properties: {
    ...stringProperties(["storeId", "storeCode", "storeName", "storeType", "status"]),
    kpiImportEnabled: { type: "boolean" },
    contactEmails: {
      type: "array",
      items: {
        type: "object",
        required: ["emailAddress", "label", "isPrimary"],
        properties: {
          emailAddress: { type: "string", format: "email" },
          label: { type: "string", nullable: true },
          isPrimary: { type: "boolean" },
        },
      },
    },
    ingestStatus: { type: "string", enum: ["disabled", "inactive", "no_source", "ready", "partial", "unmatched"] },
    matchedSourceCount: { type: "integer", minimum: 0 },
    activeSourceCount: { type: "integer", minimum: 0 },
    lastSuccessfulKpiDate: { type: "string", format: "date", nullable: true },
    ...nullableStringProperties([
      "regionId", "regionName", "regionManagerUserId", "regionManagerName", "updatedAt",
    ]),
  },
};

export const personnelMasterLookupsSchema = {
  type: "object",
  required: ["stores", "positions", "employmentStatuses", "employmentTypes"],
  properties: {
    stores: {
      type: "array",
      items: {
        type: "object",
        required: ["storeId", "storeCode", "storeName", "regionId", "regionName"],
        properties: stringProperties(["storeId", "storeCode", "storeName", "regionId", "regionName"]),
      },
    },
    positions: {
      type: "array",
      items: {
        type: "object",
        required: ["positionId", "positionCode", "positionName", "isManagerial"],
        properties: {
          ...stringProperties(["positionId", "positionCode", "positionName"]),
          isManagerial: { type: "boolean" },
        },
      },
    },
    employmentStatuses: enumLookup(["active", "inactive", "terminated"]),
    employmentTypes: enumLookup(["full_time", "part_time", "temporary"]),
  },
};

export const personnelMasterItemSchema = {
  type: "object",
  required: [
    "employeeId", "externalEmployeeRef", "firstName", "lastName", "displayName", "nationalIdLast4",
    "phoneNumber", "hireDate", "terminationDate", "employmentStatus", "employmentType", "assignmentId",
    "assignmentStartDate", "storeId", "storeCode", "storeName", "regionId", "regionName", "positionId",
    "positionCode", "positionName", "accountStatus", "updatedAt",
  ],
  properties: {
    ...stringProperties(["employeeId", "firstName", "lastName", "displayName", "hireDate", "employmentStatus", "employmentType"]),
    ...nullableStringProperties([
      "externalEmployeeRef", "nationalIdLast4", "phoneNumber", "terminationDate", "assignmentId",
      "assignmentStartDate", "storeId", "storeCode", "storeName", "regionId", "regionName", "positionId",
      "positionCode", "positionName", "updatedAt",
    ]),
    accountStatus: { type: "string", enum: ["none", "pending", "active", "inactive", "failed"] },
  },
};

function stringProperties(names: string[]) {
  return Object.fromEntries(names.map((name) => [name, { type: "string" }]));
}

function nullableStringProperties(names: string[]) {
  return Object.fromEntries(names.map((name) => [name, { type: "string", nullable: true }]));
}

function enumLookup(values: string[]) {
  return {
    type: "array",
    items: {
      type: "object",
      required: ["value", "label"],
      properties: { value: { type: "string", enum: values }, label: { type: "string" } },
    },
  };
}
