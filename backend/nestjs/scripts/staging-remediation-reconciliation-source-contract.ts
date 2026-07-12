import { sha256Hex } from "./staging-remediation-diagnostic-contract";

export type TargetDuplicateApplicationContractProof = {
  code: "target_duplicate_employee_rejected";
  sourceDigest: string;
  state: "present";
};

// Trace: FR-07, FR-11; NFR-05; AC-02, AC-04; EC-06.
export function verifyTargetDuplicateApplicationContract(
  serviceSource: string,
  serviceSpec: string,
): TargetDuplicateApplicationContractProof {
  const createMethod = methodSlice(serviceSource, "async createRequest(", "async listRequests(");
  const approvalMethod = methodSlice(serviceSource, "async approveRequest(", "async listStorePersonnel(");

  assertOrdered(createMethod, [
    "this.assertDistinctEmployees(input.allocations);",
    "this.assertAllocationsBelongToStore({",
    "this.targetDistributionRepository.createRequest({",
  ]);
  assertOrdered(approvalMethod, [
    "this.assertDistinctEmployees(input.approvedAllocations);",
    "const approvedAllocationTotal",
    "this.assertAllocationsBelongToStore({",
    "this.targetDistributionRepository.approveRequest({",
  ]);
  if (!serviceSource.includes("private assertDistinctEmployees")) {
    throw new Error("application_contract_missing");
  }
  for (const title of [
    "rejects duplicate employees in a new target distribution request",
    "rejects duplicate employees in edited approval allocations",
  ]) {
    if (!serviceSpec.includes(title)) throw new Error("application_contract_test_missing");
  }

  return {
    code: "target_duplicate_employee_rejected",
    sourceDigest: sha256Hex(
      `target-distribution.service.ts\0${serviceSource}`
      + `\0target-distribution.service.spec.ts\0${serviceSpec}`,
    ),
    state: "present",
  };
}

function methodSlice(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error("application_contract_missing");
  return source.slice(start, end);
}

function assertOrdered(source: string, markers: string[]) {
  let cursor = -1;
  for (const marker of markers) {
    const next = source.indexOf(marker);
    if (next < 0 || next <= cursor) throw new Error("application_contract_missing");
    cursor = next;
  }
}
