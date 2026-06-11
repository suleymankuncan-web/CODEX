import { BrowserSessionSameSite } from "../../shared/app-config.service";

export interface BrowserSessionCookieOptions {
  httpOnly: boolean;
  maxAgeSeconds: number;
  name: string;
  sameSite: BrowserSessionSameSite;
  secure: boolean;
  value: string;
}

export function serializeBrowserSessionCookie(
  options: BrowserSessionCookieOptions,
): string {
  const attributes = [
    `${options.name}=${encodeURIComponent(options.value)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
    `SameSite=${formatSameSite(options.sameSite)}`,
  ];

  if (options.httpOnly) {
    attributes.push("HttpOnly");
  }

  if (options.secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function serializeClearCookie(input: {
  httpOnly: boolean;
  name: string;
  sameSite: BrowserSessionSameSite;
  secure: boolean;
}): string {
  return serializeBrowserSessionCookie({
    ...input,
    maxAgeSeconds: 0,
    value: "",
  });
}

export function parseCookieHeader(
  header: string | string[] | undefined,
): Record<string, string> {
  const cookieHeader = Array.isArray(header) ? header[0] : header;
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    const name = rawName?.trim();
    if (!name) {
      return cookies;
    }

    cookies[name] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function formatSameSite(value: BrowserSessionSameSite): string {
  switch (value) {
  case "strict":
    return "Strict";
  case "none":
    return "None";
  case "lax":
  default:
    return "Lax";
  }
}
