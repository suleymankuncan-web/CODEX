export const GSM_ONAY_KPI_CODE = "GSM_ONAY";

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
      validationError: "GSM_ONAY value is required",
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
      validationError: "GSM_ONAY value must be numeric",
    };
  }

  if (numericValue < 0 || numericValue > 100) {
    return {
      actualValue: numericValue,
      achievementRate: null,
      validationError: "GSM_ONAY value must be between 0 and 100",
    };
  }

  const ratio = numericValue <= 1 ? numericValue : numericValue / 100;

  return {
    actualValue: Number((ratio * 100).toFixed(4)),
    achievementRate: Number(ratio.toFixed(6)),
    validationError: null,
  };
}
