import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { VisualComparisonAdvisoryController } from "./visual-comparison-advisory.controller";

describe("VisualComparisonAdvisoryController", () => {
  it("[AC-8] is exclusively Region Manager scoped", () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, VisualComparisonAdvisoryController)).toEqual(["REGION_MANAGER"]);
  });
});
