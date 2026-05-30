export function getExternalIdInternalTableName(entityType: "employee" | "store") {
  return entityType === "employee" ? "ops.employee" : "ops.store";
}
