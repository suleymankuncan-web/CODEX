import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { IncentiveFinalApprovalController } from "./incentive-final-approval.controller";
import { ApproveFinalIncentivePackageDto } from "./dto/approve-final-incentive-package.dto";

const body = { period: "2026-05", regionPackageId: "00000000-0000-4000-8000-000000000040", submittedAt: "2026-06-03T00:00:00.000000Z" };
describe("final approval financial version API boundary", () => {
  it("accepts an opaque lowercase 64hex version and preserves legacy omission", async () => {
    expect(await validate(plainToInstance(ApproveFinalIncentivePackageDto, { ...body, expectedFinancialVersion: "a".repeat(64) }))).toEqual([]);
    expect(await validate(plainToInstance(ApproveFinalIncentivePackageDto, body))).toEqual([]);
  });
  it.each(["", "a".repeat(63), "a".repeat(65), "A".repeat(64), "z".repeat(64), 123])("rejects invalid financial version %s", async version => {
    expect(await validate(plainToInstance(ApproveFinalIncentivePackageDto, { ...body, expectedFinancialVersion: version })))
      .toEqual(expect.arrayContaining([expect.objectContaining({ property: "expectedFinancialVersion" })]));
  });
  it.each(["approve", "return"] as const)("passes the expected version through the %s controller path", async decision => {
    const approveFinalPackage = jest.fn(async () => ({ data: {} }));
    const controller = new IncentiveFinalApprovalController({ approveFinalPackage } as never);
    const actor = buildAuthenticatedUser({ userId: "viewer", roleCodes: ["REPORT_VIEWER"], readScope: { companyIds: [], regionIds: [], storeIds: [] } });
    await controller.approve({ user: actor }, { ...body, decision, reviewNote: "Review note", expectedFinancialVersion: "a".repeat(64) });
    expect(approveFinalPackage).toHaveBeenCalledWith({ actor, periodKey: body.period, regionPackageId: body.regionPackageId,
      submittedAt: body.submittedAt, decision, reviewNote: "Review note", expectedFinancialVersion: "a".repeat(64) });
  });
});
