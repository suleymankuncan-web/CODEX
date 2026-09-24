export function isZeroMoney(value: string) {
  return parseMoneyCents(value) === 0n;
}

export function resolveFinalAmount(input: {
  payableAmount: string | null;
  correctionAmount: string | null;
  adjustmentAmount: string | null;
  persistedFinalAmount: string | null;
}) {
  if (input.persistedFinalAmount !== null) {
    const adjusted = input.adjustmentAmount
      ? parseMoneyCents(input.persistedFinalAmount) + parseMoneyCents(input.adjustmentAmount)
      : parseMoneyCents(input.persistedFinalAmount);
    return formatCents(adjusted);
  }

  if (!input.correctionAmount && !input.adjustmentAmount) {
    return null;
  }

  if (input.payableAmount === null) {
    return null;
  }

  const base = parseMoneyCents(input.payableAmount);
  const correction = input.correctionAmount ? parseMoneyCents(input.correctionAmount) : 0n;
  const adjustment = input.adjustmentAmount ? parseMoneyCents(input.adjustmentAmount) : 0n;
  return formatCents(base + correction + adjustment);
}

export function formatMoney2(value: string) {
  return formatCents(parseMoneyCents(value));
}

function parseMoneyCents(value: string) {
  const trimmed = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);

  if (!match) {
    throw new Error("Invalid money value");
  }

  const [, sign, whole, fraction = ""] = match;
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return sign === "-" ? -cents : cents;
}

function formatCents(cents: bigint) {
  const sign = cents < 0n ? "-" : "";
  const absolute = cents < 0n ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  return `${sign}${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
}
