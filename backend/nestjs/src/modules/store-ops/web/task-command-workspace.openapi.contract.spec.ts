import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Task command workspace OpenAPI", () => {
  const document = JSON.parse(
    readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
  );

  it("publishes the bounded workspace and audit operations", () => {
    expect(document.paths["/api/store/tasks/workspace"]?.get).toBeDefined();
    expect(document.paths["/api/store/tasks/{actionPlanId}/events"]?.get).toBeDefined();
    expect(document.components.schemas.TaskCommandWorkspace.properties.capabilities)
      .toEqual({ $ref: "#/components/schemas/TaskCommandCapabilities" });
    expect(document.components.schemas.TaskCommandAuditEvent.properties)
      .not.toHaveProperty("actorUserId");
    expect(document.components.schemas.TaskCommandSource.properties.deepLink).toEqual({
      type: "string",
      nullable: true,
      pattern: "^/store/(checklists|kpis)(\\?.*)?$",
    });
    const eventPathParameters =
      document.paths["/api/store/tasks/{actionPlanId}/events"].get.parameters;
    expect(eventPathParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "actionPlanId",
        in: "path",
        required: true,
        schema: expect.objectContaining({ format: "uuid" }),
      }),
    ]));
  });
});
