import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const workspaceRoot = join(import.meta.dirname, "..");
const requiredCspDirectives = [
  "default-src 'self'",
  "script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev https://challenges.cloudflare.com",
  "connect-src 'self' https://api-staging.hr-axis.com https://api.hr-axis.com https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev https://o4511716657987584.ingest.de.sentry.io",
  "frame-src https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev https://challenges.cloudflare.com",
  "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.accounts.dev https://*.clerk.com https://*.clerk.dev",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
];

function readText(path) {
  return readFileSync(join(workspaceRoot, path), "utf8");
}

test("frontend deployments set baseline browser security headers", () => {
  const vercelConfig = JSON.parse(readText("admin-web/vercel.json"));
  const vercelHeaderSets = vercelConfig.headers.map((entry) =>
    Object.fromEntries(entry.headers.map((header) => [header.key, header.value])),
  );

  for (const headers of vercelHeaderSets) {
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["Strict-Transport-Security"], "max-age=31536000; includeSubDomains");
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.equal(
      headers["Permissions-Policy"],
      "camera=(), microphone=(), geolocation=(), payment=()",
    );

    const csp = headers["Content-Security-Policy"];
    assert.ok(csp, "frontend responses must set Content-Security-Policy");
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.doesNotMatch(csp, /(?:^|;)\s*default-src\s+\*/);

    for (const directive of requiredCspDirectives) {
      assert.match(csp, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }

  const nginxConfig = readText("admin-web/nginx.conf");
  for (const expected of [
    'add_header X-Content-Type-Options "nosniff" always;',
    'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
    'add_header X-Frame-Options "DENY" always;',
    'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    'add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;',
  ]) {
    assert.match(nginxConfig, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const directive of requiredCspDirectives) {
    assert.match(nginxConfig, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("backend API installs the shared security headers middleware", () => {
  const configureHttpSecurity = readText("backend/nestjs/src/shared/http/configure-http-security.ts");
  const middleware = readText("backend/nestjs/src/shared/http/security-headers.middleware.ts");

  assert.match(configureHttpSecurity, /createSecurityHeadersMiddleware/);
  assert.match(configureHttpSecurity, /app\.use\(createSecurityHeadersMiddleware\(\)\)/);
  assert.match(middleware, /"X-Content-Type-Options": "nosniff"/);
  assert.match(middleware, /"Strict-Transport-Security": "max-age=31536000; includeSubDomains"/);
  assert.match(middleware, /"X-Frame-Options": "DENY"/);
  assert.match(middleware, /"Referrer-Policy": "strict-origin-when-cross-origin"/);
  assert.match(middleware, /"Permissions-Policy": "camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\)"/);
});
