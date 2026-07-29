import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

test("container fallback sets baseline browser security headers", () => {
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

test("temporary Vercel rollback keeps the same browser security boundary", () => {
  const vercelConfig = JSON.parse(readText("admin-web/vercel.json"));
  const headerSets = vercelConfig.headers.map((entry) =>
    Object.fromEntries(entry.headers.map((header) => [header.key, header.value])),
  );

  for (const headers of headerSets) {
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["Strict-Transport-Security"], "max-age=31536000; includeSubDomains");
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.equal(headers["Permissions-Policy"], "camera=(), microphone=(), geolocation=(), payment=()");
    for (const directive of requiredCspDirectives) {
      assert.match(
        headers["Content-Security-Policy"],
        new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
    }
  }
});

test("Cloudflare Workers assets preserve SPA and browser security contracts", () => {
  const wrangler = JSON.parse(readText("admin-web/wrangler.jsonc"));
  assert.equal(wrangler.name, "hr-axis-staging-frontend");
  assert.equal(wrangler.assets.directory, "./dist");
  assert.equal(wrangler.assets.not_found_handling, "single-page-application");
  assert.equal(wrangler.main, undefined, "static frontend must not add Worker runtime code");
  assert.equal(
    existsSync(join(workspaceRoot, "admin-web/vercel.json")),
    true,
    "Vercel rollback config remains until post-cutover live proof",
  );
  assert.equal(existsSync(join(workspaceRoot, "admin-web/.vercelignore")), true);

  const cloudflareHeaders = readText("admin-web/public/_headers");
  assert.match(cloudflareHeaders, /^\/\*/m);
  assert.match(cloudflareHeaders, /^\/assets\/\*/m);
  assert.match(cloudflareHeaders, /X-Content-Type-Options: nosniff/);
  assert.match(
    cloudflareHeaders,
    /Strict-Transport-Security: max-age=31536000; includeSubDomains/,
  );
  assert.match(cloudflareHeaders, /X-Frame-Options: DENY/);
  assert.match(cloudflareHeaders, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(
    cloudflareHeaders,
    /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\)/,
  );
  assert.match(cloudflareHeaders, /Cache-Control: public, max-age=31536000, immutable/);
  assert.doesNotMatch(cloudflareHeaders, /unsafe-eval/);
  assert.doesNotMatch(cloudflareHeaders, /(?:^|;)\s*default-src\s+\*/);

  for (const directive of requiredCspDirectives) {
    assert.match(
      cloudflareHeaders,
      new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});

test("Cloudflare upload and promotion are exact-commit separated", () => {
  const packageJson = JSON.parse(readText("admin-web/package.json"));
  const releaseScript = readText("admin-web/scripts/cloudflare-release.mjs");

  assert.match(packageJson.scripts["upload:cloudflare:artifact"], /cloudflare-release\.mjs upload/);
  assert.match(packageJson.scripts["promote:cloudflare:version"], /cloudflare-release\.mjs promote/);
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /wrangler deploy/);
  assert.match(releaseScript, /status --porcelain|\['status', '--porcelain'/);
  assert.match(releaseScript, /versions'.*upload/s);
  assert.match(releaseScript, /versions'.*deploy/s);
  assert.match(releaseScript, /git-\$\{head\.slice\(0, 12\)\}/);
  assert.match(releaseScript, /\$\{tag\}@100%/);
  assert.match(releaseScript, /npm.*run.*build:cloudflare/s);
  assert.match(releaseScript, /VITE_SENTRY_RELEASE: head/);
  assert.match(releaseScript, /fetch', 'origin', 'main'/);
  assert.match(releaseScript, /branch !== 'main' \|\| head !== originMain/);
  assert.match(releaseScript, /postBuildStatus/);
  assert.match(releaseScript, /spawnSync\(process\.execPath/);
});

test("Cloudflare release dependencies execute through Node on this operator platform", () => {
  assert.ok(process.env.npm_execpath, "canonical npm execution must expose npm_execpath");
  const npm = spawnSync(process.execPath, [process.env.npm_execpath, "--version"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  assert.equal(npm.status, 0, npm.stderr || npm.error?.message);

  const wrangler = spawnSync(
    process.execPath,
    [join(workspaceRoot, "admin-web/node_modules/wrangler/bin/wrangler.js"), "--version"],
    { cwd: join(workspaceRoot, "admin-web"), encoding: "utf8" },
  );
  assert.equal(wrangler.status, 0, wrangler.stderr || wrangler.error?.message);
  assert.match(wrangler.stdout.trim(), /^\d+\.\d+\.\d+(?:[-+].+)?$/);
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

test("checklist evidence previews stay same-origin instead of widening CSP to provider hosts", () => {
  const control = readText(
    "admin-web/src/features/checklist-workflow/ChecklistItemEvidenceControl.tsx",
  );
  const api = readText("admin-web/src/features/checklists/api.ts");
  const controller = readText(
    "backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts",
  );

  assert.match(control, /getMobileChecklistItemEvidenceContent/);
  assert.doesNotMatch(control, /getMobileChecklistItemEvidenceReadUrl/);
  assert.match(api, /fetchBlob\(/);
  assert.match(controller, /Cache-Control", "private, no-store/);
  assert.match(controller, /new StreamableFile/);
  assert.doesNotMatch(readText("admin-web/public/_headers"), /r2\.cloudflarestorage\.com/);
  assert.doesNotMatch(readText("admin-web/nginx.conf"), /r2\.cloudflarestorage\.com/);
});
