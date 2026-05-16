import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const csvHelper = readFileSync("admin-web/src/lib/download-csv.ts", "utf8");

test("CSV export helper neutralizes spreadsheet formula prefixes", () => {
  assert.match(csvHelper, /CSV_FORMULA_PREFIX_PATTERN/);
  assert.match(csvHelper, /\^\[=\+\\-@\\t\\r\\n\]/);
  assert.match(csvHelper, /text\.trimStart\(\)/);
  assert.match(csvHelper, /\? `'\$\{text\}`/);
});

test("CSV export uses the shared safe cell helper for headers and rows", () => {
  assert.match(csvHelper, /function escapeCsvCellForDownload/);
  assert.match(csvHelper, /input\.columns\.map\(escapeCsvCellForDownload\)/);
  assert.match(csvHelper, /row\.map\(escapeCsvCellForDownload\)/);
});
