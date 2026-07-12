import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  verifyTargetDuplicateApplicationContract,
} from "../scripts/staging-remediation-reconciliation-source-contract";

const sourcePath = join(
  __dirname,
  "..",
  "src",
  "modules",
  "store-ops",
  "application",
  "target-distribution.service.ts",
);
const specPath = sourcePath.replace(/\.ts$/, ".spec.ts");

describe("REM-7 target duplicate application source contract", () => {
  // Trace: FR-07, FR-11; NFR-05; AC-02, AC-04; EC-06.
  it("binds create and edited approval rejection before persistence", () => {
    const proof = verifyTargetDuplicateApplicationContract(
      readFileSync(sourcePath, "utf8"),
      readFileSync(specPath, "utf8"),
    );
    expect(proof.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ["create guard", (source: string) => source.replace("this.assertDistinctEmployees(input.allocations);", "")],
    ["approval guard", (source: string) => source.replace("this.assertDistinctEmployees(input.approvedAllocations);", "")],
    ["guard implementation", (source: string) => source.replace("private assertDistinctEmployees", "private removedDistinctEmployees")],
  ])("fails closed when the %s is absent", (_name, mutate) => {
    expect(() => verifyTargetDuplicateApplicationContract(
      mutate(readFileSync(sourcePath, "utf8")),
      readFileSync(specPath, "utf8"),
    )).toThrow("application_contract_missing");
  });

  it("requires behavioral tests for both guarded paths", () => {
    const tests = readFileSync(specPath, "utf8").replace(
      "rejects duplicate employees in edited approval allocations",
      "edited approval scenario removed",
    );
    expect(() => verifyTargetDuplicateApplicationContract(
      readFileSync(sourcePath, "utf8"), tests,
    )).toThrow("application_contract_test_missing");
  });
});
