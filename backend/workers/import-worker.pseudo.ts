type ImportEntityType = "employee" | "store" | "kpi";

interface ImportJob {
  batchId: string;
  sourceCode: string;
  entityType: ImportEntityType;
  actorUserId: string;
}

export async function runImportJob(job: ImportJob): Promise<void> {
  await markBatchProcessing(job.batchId);
  await writeAuditEvent("import_batch.started", job);

  const rows = await loadRawRows(job.batchId, job.entityType);

  for (const row of rows) {
    const validation = validatePayload(job.entityType, row.payloadJson);
    if (!validation.ok) {
      await markRowFailed(row.id, validation.error);
      continue;
    }

    const mappedIds = await resolveExternalIds(job.sourceCode, job.entityType, row.payloadJson);
    if (!mappedIds.ok) {
      await markRowFailed(row.id, mappedIds.error);
      continue;
    }

    await upsertOperationalRecord(job.entityType, row.payloadJson, mappedIds.value);
    await markRowProcessed(row.id);
  }

  await finalizeBatch(job.batchId);
  await writeAuditEvent("import_batch.completed", job);
}

async function markBatchProcessing(_batchId: string) {}
async function loadRawRows(_batchId: string, _entityType: ImportEntityType) { return []; }
function validatePayload(_entityType: ImportEntityType, _payloadJson: unknown) { return { ok: true as const }; }
async function resolveExternalIds(_sourceCode: string, _entityType: ImportEntityType, _payloadJson: unknown) { return { ok: true as const, value: {} }; }
async function upsertOperationalRecord(_entityType: ImportEntityType, _payloadJson: unknown, _mappedIds: unknown) {}
async function markRowFailed(_rowId: string, _error: string) {}
async function markRowProcessed(_rowId: string) {}
async function finalizeBatch(_batchId: string) {}
async function writeAuditEvent(_eventType: string, _metadata: unknown) {}
