import { ConflictException } from "@nestjs/common";
import { rethrowMasterIdentityCodeConflict } from "./master-identity-code-error";

describe("rethrowMasterIdentityCodeConflict", () => {
  it.each([
    { code: "40001" },
    { code: "23514", constraint: "ck_master_identity_code_owner" },
    { code: "23514", constraint: "ck_external_id_master_code_owner" },
    { code: "23505", constraint: "uq_employee_company_external_ref" },
    { code: "23505", constraint: "store_store_code_key" },
  ])("maps known master identity database failures to conflict", (error) => {
    expect(() => rethrowMasterIdentityCodeConflict(error)).toThrow(ConflictException);
  });

  it("preserves unrelated database failures", () => {
    const error = { code: "23503", constraint: "other_fk" };
    let caught: unknown;
    try {
      rethrowMasterIdentityCodeConflict(error);
    } catch (candidate) {
      caught = candidate;
    }
    expect(caught).toBe(error);
  });
});
