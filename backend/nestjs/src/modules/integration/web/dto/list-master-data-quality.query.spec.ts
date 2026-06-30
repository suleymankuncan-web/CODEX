import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListMasterDataQualityAuditQueryDto } from "./list-master-data-quality-audit.query";
import { ListMasterDataQualityIssuesQueryDto } from "./list-master-data-quality-issues.query";

describe("master data quality query DTOs", () => {
  it("caps issue projection page size at 200", async () => {
    const dto = plainToInstance(ListMasterDataQualityIssuesQueryDto, {
      limit: "201",
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "limit")).toBe(true);
  });

  it("caps audit page size at 100", async () => {
    const dto = plainToInstance(ListMasterDataQualityAuditQueryDto, {
      limit: "101",
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "limit")).toBe(true);
  });
});
