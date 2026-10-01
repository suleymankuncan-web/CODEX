import { ForbiddenException } from "@nestjs/common";

export function assertBrowserSessionOrigin(headers: Record<string, string | string[] | undefined>, allowed: string[]) {
  const origin = exactHeader(headers.origin);
  const fetchSite = exactHeader(headers["sec-fetch-site"]);
  if (!origin || !allowed.includes(origin) ||
    (headers["sec-fetch-site"] !== undefined && fetchSite !== "same-origin")) {
    throw new ForbiddenException("CSRF recovery request metadata is invalid");
  }
  return origin;
}

function exactHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value;
}
