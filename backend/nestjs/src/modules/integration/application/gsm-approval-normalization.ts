export const GSM_APPROVAL_KPI_CODE = "gsm_approval";
export const LEGACY_GSM_ONAY_KPI_CODE = "GSM_ONAY";

export function normalizeGsmApprovalKpiCode(value: unknown): string {
  const rawCode = String(value ?? "").trim();
  const normalizedCode = rawCode
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return normalizedCode === "gsm_onay" || normalizedCode === GSM_APPROVAL_KPI_CODE
    ? GSM_APPROVAL_KPI_CODE
    : rawCode;
}

export type NormalizedGsmOnayValue = {
  actualValue: number;
  achievementRate: number | null;
  validationError: string | null;
};

export function normalizeGsmOnayValue(rawValue: unknown): NormalizedGsmOnayValue {
  if (
    rawValue === undefined ||
    rawValue === null ||
    String(rawValue).trim() === ""
  ) {
    return {
      actualValue: 0,
      achievementRate: null,
      validationError: "gsm_approval value is required",
    };
  }

  const numericValue =
    typeof rawValue === "number"
      ? rawValue
      : Number(
          String(rawValue)
            .replace("%", "")
            .replace(/\s+/g, "")
            .replace(/\.(?=\d{3}(?:\D|$))/g, "")
            .replace(",", "."),
        );

  if (!Number.isFinite(numericValue)) {
    return {
      actualValue: 0,
      achievementRate: null,
      validationError: "gsm_approval value must be numeric",
    };
  }

  if (numericValue < 0 || numericValue > 100) {
    return {
      actualValue: numericValue,
      achievementRate: null,
      validationError: "gsm_approval value must be between 0 and 100",
    };
  }

  const ratio = numericValue <= 1 ? numericValue : numericValue / 100;

  return {
    actualValue: Number((ratio * 100).toFixed(4)),
    achievementRate: Number(ratio.toFixed(6)),
    validationError: null,
  };
}
