import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListTargetCoverageQueryDto } from "./list-target-coverage.query";

describe("ListTargetCoverageQueryDto", () => {
  it("accepts the month-start date format used by the Store Targets page", async () => {
    const dto = plainToInstance(ListTargetCoverageQueryDto, {
      requestMonth: "2026-05-01",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejects a bare year-month value before it reaches the repository", async () => {
    const dto = plainToInstance(ListTargetCoverageQueryDto, {
      requestMonth: "2026-05",
    });

    const errors = await validate(dto);

    expect(JSON.stringify(errors)).toContain("requestMonth");
  });
});
