import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import * as ts from "typescript";

import { AUDIT_EVENT_CATALOG, getAuditEventCatalogEntry } from "./audit-event-catalog";

const MODULE_SOURCE_DIR = join(process.cwd(), "src", "modules");
const EVENT_LITERAL_PATTERN = /["'`]([a-z][a-z0-9_]+\.[a-z][a-z0-9_]+(?:_[a-z0-9]+)*)["'`]/g;
const ENTITY_NAME_PREFIXES = ["ops.", "stg.", "rpt.", "audit."];
// Operational log events do not enter audit.event_log; delivery history lives
// in the dedicated no-positive-sales alert ledger instead.
const NON_AUDIT_EVENT_PREFIXES = ["power_bi_export_upload.", "no_sales_alert."];

// Exact warn-only diagnostics live in delivery ledgers; the same literal in
// an audit emitter remains discoverable. New names are never prefix-exempted.
const MAIL_LOG_DIAGNOSTICS = new Set([
  'incentive_mail.smtp_preflight_failed', 'incentive_mail.notice_not_confirmed',
  'incentive_mail.event_pending', 'incentive_mail.poll_failed',
  'incentive_mail.hr_mailbox_not_safe', 'incentive_mail.hr_delivery_uncertain',
  'operational_mail.configuration_incomplete', 'operational_mail.smtp_preflight_failed',
  'operational_mail.event_pending', 'operational_mail.poll_failed',
  'operational_mail.recipient_configuration_incomplete', 'operational_mail.delivery_not_confirmed',
]);

describe("AUDIT_EVENT_CATALOG", () => {
  it("catalogs every backend audit event literal emitted by modules", () => {
    expect([...collectModuleAuditEventTypes()].sort()).toEqual(
      AUDIT_EVENT_CATALOG.map((entry) => entry.eventType).sort(),
    );
  });

  it("keeps audit event names unique and lookup-safe", () => {
    const eventTypes = AUDIT_EVENT_CATALOG.map((entry) => entry.eventType);

    expect(new Set(eventTypes).size).toBe(eventTypes.length);
    for (const eventType of eventTypes) {
      expect(getAuditEventCatalogEntry(eventType)?.eventType).toBe(eventType);
    }
    expect(getAuditEventCatalogEntry("unknown.event")).toBeNull();
  });

  it("uses stable taxonomy metadata for future audit stream decisions", () => {
    for (const entry of AUDIT_EVENT_CATALOG) {
      expect(entry.eventType).toMatch(/^[a-z][a-z0-9_]+\.[a-z][a-z0-9_]+(?:_[a-z0-9]+)*$/);
      expect(entry.entityName).toMatch(/^(ops|stg|rpt)\.[a-z][a-z0-9_]+$/);
      expect(entry.ownerModule).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(["feature_audit", "global_feed_candidate"]).toContain(entry.auditStreamReadiness);
      expect(entry.description.trim().length).toBeGreaterThan(8);
    }
  });
});

function collectModuleAuditEventTypes() {
  const eventTypes = new Set<string>();

  for (const filePath of walkTypeScriptFiles(MODULE_SOURCE_DIR)) {
    const source = readFileSync(filePath, "utf8");
    for (const eventType of auditEventTypesInSource(source)) eventTypes.add(eventType);
  }

  return eventTypes;
}

function walkTypeScriptFiles(directory: string): string[] {
  const filePaths: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...walkTypeScriptFiles(filePath));
      continue;
    }

    const relativePath = relative(MODULE_SOURCE_DIR, filePath);
    if (entry.isFile() && filePath.endsWith(".ts") && !relativePath.endsWith(".spec.ts")) {
      filePaths.push(filePath);
    }
  }

  return filePaths;
}

function isAuditEventType(value: string) {
  return (
    !ENTITY_NAME_PREFIXES.some((prefix) => value.startsWith(prefix)) &&
    !NON_AUDIT_EVENT_PREFIXES.some((prefix) => value.startsWith(prefix))
  );
}

function auditEventTypesInSource(source: string) {
  const events = new Set<string>();
  const diagnosticPositions = new Set<number>();
  const candidate = [...MAIL_LOG_DIAGNOSTICS].some(event => source.includes(event));
  const file = candidate ? ts.createSourceFile('audit-source.ts', source, ts.ScriptTarget.Latest, true) : null;
  function visit(node: ts.Node) {
    if (ts.isStringLiteralLike(node) && MAIL_LOG_DIAGNOSTICS.has(node.text)) {
      const call = node.parent;
      if (ts.isCallExpression(call) && call.arguments[0] === node && ts.isPropertyAccessExpression(call.expression)
        && call.expression.name.text === 'warn' && ts.isPropertyAccessExpression(call.expression.expression)
        && call.expression.expression.name.text === 'logger' && call.expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
        diagnosticPositions.add(node.getStart());
      }
    }
    ts.forEachChild(node, visit);
  }
  if (file) visit(file);
  for (const match of source.matchAll(EVENT_LITERAL_PATTERN)) {
    const eventType = match[1];
    if (isAuditEventType(eventType) && !diagnosticPositions.has(match.index)) events.add(eventType);
  }
  return events;
}

it('exempts exact mail warn diagnostics without hiding audit emitters or new names', () => {
  expect([...auditEventTypesInSource('this.logger.warn("incentive_mail.poll_failed")')]).toEqual([]);
  expect([...auditEventTypesInSource('audit.writeEvent({eventType:"incentive_mail.poll_failed"})')]).toEqual(['incentive_mail.poll_failed']);
  expect([...auditEventTypesInSource('this.logger.warn("incentive_mail.new_event")')]).toEqual(['incentive_mail.new_event']);
  expect([...auditEventTypesInSource('this.logger.error("operational_mail.poll_failed")')]).toEqual(['operational_mail.poll_failed']);
  expect([...auditEventTypesInSource('/* this.logger.warn("incentive_mail.poll_failed") */')]).toEqual(['incentive_mail.poll_failed']);
  expect([...auditEventTypesInSource('const sql = `this.logger.warn("incentive_mail.poll_failed")`')]).toEqual(['incentive_mail.poll_failed']);
  expect([...auditEventTypesInSource('this.logger.warn("incentive_mail.poll_failed", audit.write("incentive_mail.poll_failed"))')]).toEqual(['incentive_mail.poll_failed']);
});
