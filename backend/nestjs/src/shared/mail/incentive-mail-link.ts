import { ConfigService } from "@nestjs/config";

/** An explicit mail origin or the sole already-approved browser origin. Ambiguous config fails closed. */
export function incentiveMailOrigin(config: ConfigService): string | null {
  try {
    const explicit = config.get<string>("INCENTIVE_APPROVAL_EMAIL_APP_ORIGIN")?.trim();
    const origins = (config.get<string>("CORS_ALLOWED_ORIGINS") ?? "").split(",").map(s=>s.trim()).filter(Boolean);
    const value = explicit || (origins.length === 1 ? origins[0] : "");
    if (!value) return null;
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" ? url.origin : null;
  } catch { return null; }
}

export function incentiveMailLink(origin: string, period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("incentive_mail_invalid_period");
  const url = new URL("/store/incentives",origin);
  url.searchParams.set("period",period);
  return url.href;
}
