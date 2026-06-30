export const masterDataIssueAffectedModules = {
  storeScope: ["KPI", "Hedefler", "Primler", "Raporlar"],
  storeManager: ["Hedefler", "Görevler", "Checklist", "Raporlar"],
  personnelAssignment: ["Norm Kadro", "Hedefler", "Primler", "Raporlar"],
  personnelSellerCode: ["Satış", "KPI", "Primler", "Ranking"],
  importBatch: ["İçe Aktarım", "Ana Veri", "Raporlar"],
} as const;

export function summarizeMasterDataAuditEvent(input: {
  eventType: string;
  entityLabel: string;
}) {
  if (input.eventType === "store_master_data.updated") {
    return `${input.entityLabel} mağaza kaydı güncellendi`;
  }
  if (input.eventType === "personnel_master_data.updated") {
    return `${input.entityLabel} personel kaydı güncellendi`;
  }
  if (input.eventType.startsWith("import_batch.")) {
    return `${input.entityLabel} içe aktarım kaydı güncellendi`;
  }
  if (input.eventType.startsWith("master_data_bootstrap.")) {
    return `${input.entityLabel} ana veri aktarımı güncellendi`;
  }

  return `${input.entityLabel} kaydı güncellendi`;
}
