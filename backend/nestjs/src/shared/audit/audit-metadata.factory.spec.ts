import { RequestContextStore } from "../request-context";
import { buildRequestAuditMetadata } from "./audit-metadata.factory";

describe("buildRequestAuditMetadata", () => {
  it("includes correlationId from request context", () => {
    const metadata = RequestContextStore.run(
      { correlationId: "corr-audit-test", actorUserId: "user-1" },
      () =>
        buildRequestAuditMetadata({
          sourceContext: {
            module: "test",
            operation: "build-audit-metadata",
          },
          changedFields: ["status"],
          details: {
            status: "active",
          },
        }),
    );

    expect(metadata.correlationId).toBe("corr-audit-test");
    expect(metadata.sourceContext).toEqual({
      module: "test",
      operation: "build-audit-metadata",
    });
    expect(metadata.changedFields).toEqual(["status"]);
    expect(metadata.details).toEqual({ status: "active" });
  });
});
