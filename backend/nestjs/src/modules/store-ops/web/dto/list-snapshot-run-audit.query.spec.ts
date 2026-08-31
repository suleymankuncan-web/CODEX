import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListSnapshotRunAuditQueryDto } from "./list-snapshot-run-audit.query";

describe("snapshot run audit pagination query", () => {
  it("rejects an oversized limit and negative offset", async () => {
    const dto = plainToInstance(ListSnapshotRunAuditQueryDto, {
      limit: "201",
      offset: "-1",
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["limit", "offset"]),
    );
  });

  it("accepts the documented maximum limit and zero offset", async () => {
    const dto = plainToInstance(ListSnapshotRunAuditQueryDto, {
      limit: "200",
      offset: "0",
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
