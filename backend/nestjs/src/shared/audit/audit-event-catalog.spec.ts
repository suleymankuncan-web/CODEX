import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { AUDIT_EVENT_CATALOG, getAuditEventCatalogEntry } from "./audit-event-catalog";

const MODULE_SOURCE_DIR = join(process.cwd(), "src", "modules");
const EVENT_LITERAL_PATTERN = /["'`]([a-z][a-z0-9_]+\.[a-z][a-z0-9_]+(?:_[a-z0-9]+)*)["'`]/g;
const ENTITY_NAME_PREFIXES = ["ops.", "stg.", "rpt.", "audit."];
const NON_AUDIT_EVENT_PREFIXES = ["power_bi_export_upload."];

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
    for (const match of source.matchAll(EVENT_LITERAL_PATTERN)) {
      const eventType = match[1];
      if (isAuditEventType(eventType)) {
        eventTypes.add(eventType);
      }
    }
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
