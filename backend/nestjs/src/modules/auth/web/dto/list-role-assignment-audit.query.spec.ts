import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListRoleAssignmentAuditQueryDto } from "./list-role-assignment-audit.query";

describe("auth audit pagination query", () => {
  it("rejects an oversized limit and negative offset", async () => {
    const dto = plainToInstance(ListRoleAssignmentAuditQueryDto, {
      limit: "201",
      offset: "-1",
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["limit", "offset"]),
    );
  });

  it("accepts the documented maximum limit and zero offset", async () => {
    const dto = plainToInstance(ListRoleAssignmentAuditQueryDto, {
      limit: "200",
      offset: "0",
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
