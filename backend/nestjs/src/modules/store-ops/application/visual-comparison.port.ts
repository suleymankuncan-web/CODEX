import {
  VisualComparisonInvocation,
  VisualComparisonRequest,
} from "./visual-comparison.contract";

export interface VisualComparisonPort {
  compare(input: VisualComparisonRequest): Promise<VisualComparisonInvocation>;
}
