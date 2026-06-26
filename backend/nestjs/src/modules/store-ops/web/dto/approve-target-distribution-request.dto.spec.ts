import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ApproveTargetDistributionRequestDto } from "./approve-target-distribution-request.dto";

describe("ApproveTargetDistributionRequestDto", () => {
  it("accepts the existing note-only approve payload", async () => {
    const dto = plainToInstance(ApproveTargetDistributionRequestDto, {
      approvalNote: "Uygun",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("accepts an edited final allocation payload", async () => {
    const dto = plainToInstance(ApproveTargetDistributionRequestDto, {
      approvalNote: "Bolge muduru hedefleri dengeledi.",
      approvedTotalTargetValue: 175000,
      approvedAllocations: [
        {
          employeeId: "00000000-0000-0000-0000-000000000501",
          assigneeLabel: "Ada Kaya",
          targetValue: 100000,
          note: "Duzenlendi",
        },
        {
          employeeId: "00000000-0000-0000-0000-000000000502",
          assigneeLabel: "Ece Demir",
          targetValue: 75000,
        },
      ],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejects edited allocations without an employee id", async () => {
    const dto = plainToInstance(ApproveTargetDistributionRequestDto, {
      approvedTotalTargetValue: 175000,
      approvedAllocations: [
        {
          assigneeLabel: "Ada Kaya",
          targetValue: 100000,
        },
      ],
    });

    const errors = await validate(dto);

    expect(JSON.stringify(errors)).toContain("employeeId");
  });
});
