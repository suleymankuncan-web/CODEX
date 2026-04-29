import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateTargetDistributionRequestDto } from "./create-target-distribution-request.dto";

describe("CreateTargetDistributionRequestDto", () => {
  it("requires every target allocation to carry a real employee id", async () => {
    const dto = plainToInstance(CreateTargetDistributionRequestDto, {
      storeId: "00000000-0000-0000-0000-000000000201",
      requestMonth: "2026-03-01",
      targetLabel: "Aylik personel hedef dagitimi",
      totalTargetValue: 100000,
      allocations: [
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
