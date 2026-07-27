import "reflect-metadata";
import {
  REQUIRED_ACTION_SCOPE_KEY,
  REQUIRED_SCOPE_KEY,
} from "../../auth/decorators/scope.decorator";
import { MobileChecklistController } from "./mobile-checklist.controller";

describe("MobileChecklistController", () => {
  it("starts checklist instances with authenticated read scope and store action scope", () => {
    const handler = MobileChecklistController.prototype.startInstance;

    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, handler)).toBe("authenticated");
    expect(Reflect.getMetadata(REQUIRED_ACTION_SCOPE_KEY, handler)).toBe("store");
  });

  it.each([
    "linkEvidence",
    "uploadApprovedSyntheticEvidence",
    "finalizeApprovedSyntheticEvidence",
    "unlinkEvidence",
    "readEvidence",
    "readEvidenceContent",
  ] as const)(
    "derives store action scope from server records for %s",
    (methodName) => {
      const handler = MobileChecklistController.prototype[methodName];

      expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, handler)).toBe("authenticated");
      expect(Reflect.getMetadata(REQUIRED_ACTION_SCOPE_KEY, handler)).toBeUndefined();
    },
  );
});
