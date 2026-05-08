import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const workspaceRoot = join(import.meta.dirname, "..");

function readText(path) {
  return readFileSync(join(workspaceRoot, path), "utf8");
}

test("frontend deployments set baseline browser security headers", () => {
  const vercelConfig = JSON.parse(readText("admin-web/vercel.json"));
  const headers = Object.fromEntries(
    vercelConfig.headers[0].headers.map((header) => [header.key, header.value]),
  );

  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(
    headers["Permissions-Policy"],
    "camera=(), microphone=(), geolocation=(), payment=()",
  );

  const nginxConfig = readText("admin-web/nginx.conf");
  for (const expected of [
    'add_header X-Content-Type-Options "nosniff" always;',
    'add_header X-Frame-Options "DENY" always;',
    'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    'add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;',
  ]) {
    assert.match(nginxConfig, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("backend API installs the shared security headers middleware", () => {
  const configureHttpSecurity = readText("backend/nestjs/src/shared/http/configure-http-security.ts");
  const middleware = readText("backend/nestjs/src/shared/http/security-headers.middleware.ts");

  assert.match(configureHttpSecurity, /createSecurityHeadersMiddleware/);
  assert.match(configureHttpSecurity, /app\.use\(createSecurityHeadersMiddleware\(\)\)/);
  assert.match(middleware, /"X-Content-Type-Options": "nosniff"/);
  assert.match(middleware, /"X-Frame-Options": "DENY"/);
  assert.match(middleware, /"Referrer-Policy": "strict-origin-when-cross-origin"/);
  assert.match(middleware, /"Permissions-Policy": "camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\)"/);
});
