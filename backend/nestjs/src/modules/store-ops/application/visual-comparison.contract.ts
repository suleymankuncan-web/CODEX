export const QWEN_VISUAL_COMPARISON_MODEL = "qwen3.7-plus-2026-05-26" as const;
export const VISUAL_COMPARISON_PROMPT_POLICY_VERSION =
  "hr-axis-qwen-prompt-policy-v1" as const;
export const VISUAL_COMPARISON_RESULT_SCHEMA_VERSION =
  "hr-axis-visual-comparison-result-v1" as const;
export const VISUAL_COMPARISON_RUBRIC_VERSION = "hr-axis-vm-rubric-v1" as const;

export const VISUAL_COMPARISON_DIMENSION_KEYS = [
  "fixture_zone_layout",
  "color_palette_sequence",
  "folded_product_alignment",
  "hanging_product_color_integrity",
  "garment_condition",
  "overall_presentation_balance",
] as const;

export const VISUAL_COMPARISON_DECISIONS = [
  "pass",
  "partial",
  "fail",
  "abstain",
  "recapture_required",
] as const;

export const VISUAL_COMPARISON_REASON_CODES = [
  "aligned",
  "minor_variance",
  "material_mismatch",
  "missing_required_item",
  "unexpected_extra_item",
  "item_sequence_mismatch",
  "fixture_layout_mismatch",
  "zone_layout_mismatch",
  "color_sequence_mismatch",
  "fold_alignment_mismatch",
  "hanging_palette_mismatch",
  "garment_condition_mismatch",
  "orientation_mismatch",
  "visibility_occluded",
  "presentation_condition_mismatch",
  "image_quality_insufficient",
  "reference_variant_unsupported",
  "comparison_ambiguous",
  "instruction_text_ignored",
] as const;

export const VISUAL_COMPARISON_QUALITY_FLAGS = [
  "blur",
  "glare",
  "low_light",
  "overexposed",
  "perspective_extreme",
  "occlusion",
  "framing_incomplete",
  "resolution_insufficient",
  "instruction_like_text",
  "unsupported_layout",
] as const;

export const VISUAL_COMPARISON_MODEL_LIMITATIONS = [
  "fine_detail_uncertain",
  "color_appearance_uncertain",
  "occluded_area_unassessed",
  "reference_variant_ambiguous",
  "text_treated_as_untrusted",
] as const;

export type VisualComparisonDimensionKey =
  (typeof VISUAL_COMPARISON_DIMENSION_KEYS)[number];
export type VisualComparisonDecision =
  (typeof VISUAL_COMPARISON_DECISIONS)[number];
export type VisualComparisonReasonCode =
  (typeof VISUAL_COMPARISON_REASON_CODES)[number];
export type VisualComparisonQualityFlag =
  (typeof VISUAL_COMPARISON_QUALITY_FLAGS)[number];
export type VisualComparisonModelLimitation =
  (typeof VISUAL_COMPARISON_MODEL_LIMITATIONS)[number];

export type VisualComparisonDimension = {
  key: VisualComparisonDimensionKey;
  score: number | null;
  confidence: number;
  reasonCode: VisualComparisonReasonCode;
  explanation: string;
};

export type VisualComparisonResult = {
  decision: VisualComparisonDecision;
  dimensions: VisualComparisonDimension[];
  overallConfidence: number;
  qualityFlags: VisualComparisonQualityFlag[];
  modelLimitations: VisualComparisonModelLimitation[];
};

export type VisualComparisonCriteria = {
  dimension: VisualComparisonDimensionKey;
  requirement: string;
};

export type VisualComparisonRequest = {
  comparisonId: string;
  referenceImage: Buffer;
  evidenceImage: Buffer;
  referenceMimeType: "image/webp";
  evidenceMimeType: "image/webp";
  referenceSha256: string;
  evidenceSha256: string;
  referenceWidthPx: number;
  referenceHeightPx: number;
  evidenceWidthPx: number;
  evidenceHeightPx: number;
  criteria: VisualComparisonCriteria[];
  locale: "tr" | "en";
};

export type VisualComparisonUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsdMicros: number;
};

export type VisualComparisonInvocation = {
  result: VisualComparisonResult;
  usage: VisualComparisonUsage;
  providerRequestId?: string;
  latencyMs: number;
};

export type VisualComparisonFailureCode =
  | "disabled"
  | "invalid_configuration"
  | "invalid_request"
  | "budget_exhausted"
  | "provider_timeout"
  | "provider_rejected"
  | "provider_unavailable"
  | "invalid_provider_response"
  | "model_identity_mismatch";

export class VisualComparisonFailure extends Error {
  constructor(
    readonly code: VisualComparisonFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "VisualComparisonFailure";
  }
}
