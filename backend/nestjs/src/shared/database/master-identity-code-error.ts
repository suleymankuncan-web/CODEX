import { ConflictException } from "@nestjs/common";

export function rethrowMasterIdentityCodeConflict(error: unknown): never {
  const candidate = error as { code?: string; constraint?: string };
  if (candidate.code === "40001") {
    throw new ConflictException("Master identity code is being changed concurrently; retry the operation");
  }
  if (
    candidate.code === "23514" && (
      candidate.constraint?.startsWith("ck_master_identity_") ||
      candidate.constraint === "ck_external_id_master_code_owner"
    )
  ) {
    throw new ConflictException("Master identity code is reserved or mapped to another record");
  }
  if (candidate.code === "23505" && (
    candidate.constraint === "uq_employee_company_external_ref" ||
    candidate.constraint === "store_store_code_key"
  )) {
    throw new ConflictException("Master identity code is already in use");
  }
  throw error;
}
