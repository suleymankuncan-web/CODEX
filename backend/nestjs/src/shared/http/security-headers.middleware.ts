type SecurityHeadersResponse = {
  setHeader(name: string, value: string): void;
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

export function createSecurityHeadersMiddleware() {
  return (
    _req: unknown,
    res: SecurityHeadersResponse,
    next: () => void,
  ): void => {
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      res.setHeader(header, value);
    }

    next();
  };
}
