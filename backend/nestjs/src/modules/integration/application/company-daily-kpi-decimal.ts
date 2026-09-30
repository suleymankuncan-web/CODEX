/** Exact decimal operations at the sanitized company boundary. */
export function decimalUnits(value: string): { units: bigint; scale: number } {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match || match[2].replace(/^0+/, "").length > 26 ||
    (match[3]?.length ?? 0) > 12) throw new TypeError("company_daily_kpi_invalid_decimal");
  return { units: BigInt(`${match[1]}${match[2]}${match[3] ?? ""}`), scale: match[3]?.length ?? 0 };
}

export function sumDecimal(left: string, right: string): string {
  const a = decimalUnits(left), b = decimalUnits(right), scale = Math.max(a.scale, b.scale);
  return decimalText(a.units * 10n ** BigInt(scale - a.scale) + b.units * 10n ** BigInt(scale - b.scale), scale);
}

export function decimalText(units: bigint, scale: number): string {
  if (units === 0n) return "0";
  const sign = units < 0n ? "-" : "", value = (units < 0n ? -units : units).toString().padStart(scale + 1, "0");
  if (scale === 0) return `${sign}${value}`;
  const fraction = value.slice(-scale).replace(/0+$/, "");
  return `${sign}${value.slice(0, -scale)}${fraction ? `.${fraction}` : ""}`;
}

export function canonicalDecimal(value: string, denominator = 1n): string {
  const parsed = decimalUnits(value);
  if (denominator <= 0n) throw new TypeError("company_daily_kpi_invalid_denominator");
  const divisor = denominator * 10n ** BigInt(parsed.scale);
  const absolute = parsed.units < 0n ? -parsed.units : parsed.units;
  const rounded = (absolute * 10000n + divisor / 2n) / divisor;
  if (rounded > 999999999999999999n) throw new TypeError("company_daily_kpi_canonical_decimal_out_of_range");
  return decimalText(parsed.units < 0n ? -rounded : rounded, 4);
}
