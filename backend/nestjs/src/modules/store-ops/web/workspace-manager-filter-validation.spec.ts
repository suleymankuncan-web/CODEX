import "reflect-metadata";
import { validate } from "class-validator";
import { GetTargetWorkspaceQueryDto } from "./dto/get-target-workspace.query";
import { GetTaskCommandWorkspaceQueryDto } from "./dto/get-task-command-workspace.query";

describe.each([GetTargetWorkspaceQueryDto, GetTaskCommandWorkspaceQueryDto])(
  "%s manager filter",
  (Query) => {
    const query = (regionManagerUserId?: string) => Object.assign(new Query(), {
      period: "2026-09", periodStart: "2026-09-01", periodEnd: "2026-09-30", regionManagerUserId,
    });

    it.each([undefined, "80000000-0000-0000-0000-000000000012", "d2092026-0002-4000-8000-000000000001"])(
      "accepts an optional or existing PostgreSQL user ID: %s", async (value) => {
        expect(await validate(query(value))).toHaveLength(0);
      },
    );

    it.each(["", "not-a-user-id", "80000000-0000-0000-0000-000000000012' OR TRUE", "x0000000-0000-0000-0000-000000000012"])(
      "rejects malformed IDs: %s", async (value) => {
        expect((await validate(query(value))).map(error => error.property)).toContain("regionManagerUserId");
      },
    );
  },
);
