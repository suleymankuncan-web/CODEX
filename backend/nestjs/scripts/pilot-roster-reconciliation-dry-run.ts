import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

import {
  buildRosterReconciliationDryRun,
  type RawRosterReconciliationInput,
  type RosterReconciliationSourceKind,
  type RosterReconciliationSummary,
} from "../src/modules/store-ops/application/pilot-roster-reconciliation.contract";

const XLSX = require("@e965/xlsx");

type MatrixRow = Array<string | number | boolean | null | undefined>;

type InputFile = {
  path: string;
  sourceKind: RosterReconciliationSourceKind;
  sourcePeriod?: string;
};

const workspaceRoot = resolve(__dirname, "..", "..", "..");
const defaultOutputPath = resolve(
  workspaceRoot,
  "docs",
  "evidence",
  `pilot-roster-reconciliation-dry-run-${new Date().toISOString().slice(0, 10)}.md`,
);

const monthMap = new Map<string, string>([
  ["ocak", "01"],
  ["subat", "02"],
  ["şubat", "02"],
  ["mart", "03"],
  ["nisan", "04"],
  ["mayis", "05"],
  ["mayıs", "05"],
  ["haziran", "06"],
]);

function compact(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function key(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function parseMoney(value: unknown) {
  const raw = compact(value);
  if (!raw) {
    return null;
  }

  const monetary = raw.replace(/[₺\s]/gu, "");
  const lastCommaIndex = monetary.lastIndexOf(",");
  const lastDotIndex = monetary.lastIndexOf(".");
  const hasComma = lastCommaIndex !== -1;
  const hasDot = lastDotIndex !== -1;
  let normalized = monetary;

  if (hasComma && hasDot) {
    normalized =
      lastDotIndex > lastCommaIndex
        ? monetary.replace(/,/gu, "")
        : monetary.replace(/\./gu, "").replace(/,/gu, ".");
  } else if (hasComma) {
    const decimalLength = monetary.length - lastCommaIndex - 1;
    normalized =
      decimalLength === 3
        ? monetary.replace(/,/gu, "")
        : monetary.replace(/,/gu, ".");
  } else if (hasDot) {
    const decimalLength = monetary.length - lastDotIndex - 1;
    normalized =
      decimalLength === 3
        ? monetary.replace(/\./gu, "")
        : monetary;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferPeriodFromName(fileName: string) {
  const normalized = key(fileName);
  for (const [monthName, monthNumber] of monthMap) {
    if (normalized.includes(key(monthName))) {
      return `2026-${monthNumber}`;
    }
  }

  return undefined;
}

function splitArg(value: string) {
  const equalIndex = value.indexOf("=");
  if (equalIndex === -1) {
    return [value, ""] as const;
  }

  return [value.slice(0, equalIndex), value.slice(equalIndex + 1)] as const;
}

function readNextArg(args: string[], index: number) {
  const current = args[index] ?? "";
  const [name, inlineValue] = splitArg(current);
  if (inlineValue) {
    return { name, value: inlineValue, nextIndex: index };
  }

  return { name, value: args[index + 1] ?? "", nextIndex: index + 1 };
}

function discoverDefaultInputs(downloadDir: string): InputFile[] {
  if (!existsSync(downloadDir)) {
    return [];
  }

  const names = readdirSync(downloadDir);
  const inputs: InputFile[] = [];
  const addIfExists = (fileName: string, sourceKind: RosterReconciliationSourceKind) => {
    const filePath = join(downloadDir, fileName);
    if (existsSync(filePath)) {
      inputs.push({ path: filePath, sourceKind });
    }
  };

  addIfExists("yeni.xlsx", "current_roster");
  addIfExists("lis.xlsx", "dealer_roster");

  const salesKpiFiles: Array<[string, string]> = [
    ["2026-01", "ocak personel.xlsx"],
    ["2026-02", "şubat personel.xlsx"],
    ["2026-03", "mart personel verileri.xlsx"],
    ["2026-04", "nisan personel.xlsx"],
    ["2026-05", "mayis personel.xlsx"],
    ["2026-06", "haziran personel.xlsx"],
  ];

  for (const [sourcePeriod, fileName] of salesKpiFiles) {
    const filePath = join(downloadDir, fileName);
    if (existsSync(filePath)) {
      inputs.push({ path: filePath, sourceKind: "sales_kpi", sourcePeriod });
    }
  }

  for (const fileName of names) {
    const lowered = key(fileName);
    if (!lowered.includes("hedefleri") || !lowered.endsWith("xlsx")) {
      continue;
    }

    inputs.push({
      path: join(downloadDir, fileName),
      sourceKind: "target",
      sourcePeriod: inferPeriodFromName(fileName),
    });
  }

  return inputs;
}

function parseArgs(args: string[]) {
  const inputs: InputFile[] = [];
  let outputPath = defaultOutputPath;
  let jsonOnly = false;
  let useDefaults = true;
  let hasExplicitInput = false;

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === "--help") {
      printHelp();
      process.exit(0);
    }

    if (current === "--json") {
      jsonOnly = true;
      continue;
    }

    if (current === "--no-defaults") {
      useDefaults = false;
      continue;
    }

    const { name, value, nextIndex } = readNextArg(args, index);
    index = nextIndex;

    if (name === "--output") {
      outputPath = resolve(value);
      continue;
    }

    if (name === "--current-roster") {
      hasExplicitInput = true;
      inputs.push({ path: resolve(value), sourceKind: "current_roster" });
      continue;
    }

    if (name === "--dealer-roster") {
      hasExplicitInput = true;
      inputs.push({ path: resolve(value), sourceKind: "dealer_roster" });
      continue;
    }

    if (name === "--target") {
      const [period, path] = splitArg(value);
      hasExplicitInput = true;
      inputs.push({ path: resolve(path), sourceKind: "target", sourcePeriod: period });
      continue;
    }

    if (name === "--sales-kpi") {
      const [period, path] = splitArg(value);
      hasExplicitInput = true;
      inputs.push({ path: resolve(path), sourceKind: "sales_kpi", sourcePeriod: period });
      continue;
    }

    throw new Error(`Unknown argument: ${name}`);
  }

  if (useDefaults && !hasExplicitInput) {
    const defaultDir = process.env.PILOT_ROSTER_INPUT_DIR ?? join(homedir(), "Downloads");
    inputs.unshift(...discoverDefaultInputs(defaultDir));
  }

  return { inputs, outputPath, jsonOnly };
}

function printHelp() {
  console.log(`
Pilot roster reconciliation dry-run.

Usage:
  ts-node scripts/pilot-roster-reconciliation-dry-run.ts [options]

Options:
  --current-roster <path>        Current company roster, normally yeni.xlsx
  --dealer-roster <path>         Dealer/operator reference roster, normally lis.xlsx
  --target <YYYY-MM=path>        Monthly personnel target file
  --sales-kpi <YYYY-MM=path>     Optional monthly sales/KPI snapshot file
  --output <path>                Markdown evidence output path
  --no-defaults                  Do not auto-discover files in Downloads
  --json                         Print summary JSON to stdout
`);
}

function readWorkbookMatrix(filePath: string) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  return workbook.SheetNames.flatMap((sourceSheet: string) => {
    const sheet = workbook.Sheets[sourceSheet];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as MatrixRow[];
    return [{ sourceSheet, rows }];
  });
}

function sourcePayload(row: MatrixRow, headers?: string[]) {
  const payload: Record<string, unknown> = {};
  row.forEach((value, index) => {
    const header = headers?.[index] || `column_${index + 1}`;
    if (compact(value)) {
      payload[header] = compact(value);
    }
  });
  return payload;
}

function extractStoreFromWorkplace(value: unknown) {
  const raw = compact(value).replace(/^İşyeri Açıklaması:\s*/iu, "");
  if (!raw) {
    return "";
  }

  const parts = raw.split(/\s+-\s+/u).map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? raw;
}

function extractStoreCode(value: unknown) {
  const match = compact(value).match(/\((SM\d+)\)/iu);
  return match?.[1] ?? "";
}

function parseCurrentRosterFile(input: InputFile): RawRosterReconciliationInput[] {
  const result: RawRosterReconciliationInput[] = [];

  for (const sheet of readWorkbookMatrix(input.path)) {
    let currentStoreName = "";
    for (const [index, row] of sheet.rows.entries()) {
      const firstCell = compact(row[0]);
      if (firstCell.toLocaleLowerCase("tr-TR").startsWith("işyeri açıklaması")) {
        currentStoreName = extractStoreFromWorkplace(firstCell);
        continue;
      }

      const rawEmployeeCode = compact(row[9]);
      const rawEmployeeName = compact(row[10]);
      if (!currentStoreName || !rawEmployeeCode || !rawEmployeeName) {
        continue;
      }

      result.push({
        sourceFile: basename(input.path),
        sourceSheet: sheet.sourceSheet,
        sourceKind: input.sourceKind,
        sourcePeriod: input.sourcePeriod,
        rowNumber: index + 1,
        rawStoreName: currentStoreName,
        rawStoreCode: extractStoreCode(row[2]),
        rawEmployeeCode,
        rawEmployeeName,
        rawPositionName: compact(row[3]),
        rawPayload: sourcePayload(row),
      });
    }
  }

  return result;
}

function parseHeaderedRosterFile(input: InputFile): RawRosterReconciliationInput[] {
  const result: RawRosterReconciliationInput[] = [];

  for (const sheet of readWorkbookMatrix(input.path)) {
    const headers = sheet.rows[0]?.map((value: unknown) => compact(value)) ?? [];
    const headerIndex = new Map<string, number>(
      headers.map((header: string, index: number) => [key(header), index]),
    );
    const read = (row: MatrixRow, header: string) => {
      const index = headerIndex.get(key(header));
      return index === undefined ? "" : compact(row[index]);
    };

    for (const [index, row] of sheet.rows.entries()) {
      if (index === 0) {
        continue;
      }

      const rawEmployeeName = read(row, "PERSONEL İSMİ");
      if (!rawEmployeeName) {
        continue;
      }

      result.push({
        sourceFile: basename(input.path),
        sourceSheet: sheet.sourceSheet,
        sourceKind: input.sourceKind,
        sourcePeriod: input.sourcePeriod,
        rowNumber: index + 1,
        rawStoreName: read(row, "MAĞAZA"),
        rawStoreCode: read(row, "MAĞAZA KODU"),
        rawEmployeeCode: read(row, "PERSONEL KODU"),
        rawEmployeeName,
        rawPositionName: read(row, "ÜNVANI"),
        rawPayload: sourcePayload(row, headers),
      });
    }
  }

  return result;
}

function parseTargetFile(input: InputFile): RawRosterReconciliationInput[] {
  const result: RawRosterReconciliationInput[] = [];

  for (const sheet of readWorkbookMatrix(input.path)) {
    for (const [index, row] of sheet.rows.entries()) {
      if (index === 0) {
        continue;
      }

      const rawStoreName = compact(row[0]);
      const rawEmployeeName = compact(row[1]);
      const targetAmount = parseMoney(row[2]);
      if (!rawStoreName || !rawEmployeeName || targetAmount === null) {
        continue;
      }

      result.push({
        sourceFile: basename(input.path),
        sourceSheet: sheet.sourceSheet,
        sourceKind: "target",
        sourcePeriod: input.sourcePeriod ?? inferPeriodFromName(input.path),
        rowNumber: index + 1,
        rawStoreName,
        rawEmployeeName,
        targetAmount,
        rawPayload: sourcePayload(row, ["Mağaza Adı", "Personel", "Hedef"]),
      });
    }
  }

  return result;
}

function parseGenericSalesKpiFile(input: InputFile): RawRosterReconciliationInput[] {
  const result: RawRosterReconciliationInput[] = [];

  for (const sheet of readWorkbookMatrix(input.path)) {
    const headers = sheet.rows[0]?.map((value: unknown) => compact(value)) ?? [];
    const headerIndex = new Map<string, number>(
      headers.map((header: string, index: number) => [key(header), index]),
    );
    const readAny = (row: MatrixRow, names: string[]) => {
      for (const name of names) {
        const index = headerIndex.get(key(name));
        if (index !== undefined && compact(row[index])) {
          return compact(row[index]);
        }
      }
      return "";
    };

    for (const [index, row] of sheet.rows.entries()) {
      if (index === 0) {
        continue;
      }

      const rawEmployeeName = readAny(row, ["Adı", "Personel", "Personel İsmi", "Adı-Soyadı"]);
      const rawStoreName = readAny(row, ["Mağaza", "Mağaza Adı", "Store"]);
      if (!rawEmployeeName && !rawStoreName) {
        continue;
      }

      result.push({
        sourceFile: basename(input.path),
        sourceSheet: sheet.sourceSheet,
        sourceKind: "sales_kpi",
        sourcePeriod: input.sourcePeriod ?? inferPeriodFromName(input.path),
        rowNumber: index + 1,
        rawStoreName,
        rawEmployeeCode: readAny(row, ["Personel Kodu", "Sicil", "Employee Code"]),
        rawEmployeeName,
        rawPositionName: readAny(row, ["Ünvan", "ÜNVANI", "Pozisyon"]),
        netSalesAmount: parseMoney(
          readAny(row, ["Satış Tutarı", "Net Satış", "Net Tutar (D) Toplam", "Ciro", "Satış"]),
        ),
        rawPayload: sourcePayload(row, headers),
      });
    }
  }

  return result;
}

function parseInputFile(input: InputFile): RawRosterReconciliationInput[] {
  if (!existsSync(input.path)) {
    throw new Error(`Input file not found: ${input.path}`);
  }

  if (input.sourceKind === "current_roster") {
    return parseCurrentRosterFile(input);
  }

  if (input.sourceKind === "dealer_roster") {
    return parseHeaderedRosterFile(input);
  }

  if (input.sourceKind === "target") {
    return parseTargetFile(input);
  }

  return parseGenericSalesKpiFile(input);
}

function sectionRows(
  summary: RosterReconciliationSummary,
  section: keyof RosterReconciliationSummary["sections"],
) {
  const rows = summary.sections[section];
  if (rows.length === 0) {
    return "_Örnek yok._";
  }

  return rows
    .slice(0, 8)
    .map((row) => {
      const amount =
        row.targetAmount !== null && row.targetAmount !== undefined
          ? `target=${row.targetAmount}`
          : row.netSalesAmount !== null && row.netSalesAmount !== undefined
            ? `sales=${row.netSalesAmount}`
            : "-";
      return `- ${row.sourcePeriod ?? "-"} | ${row.rawStoreName ?? "-"} | ${row.rawEmployeeName ?? "-"} | ${row.rawPositionName ?? "-"} | ${amount} | ${row.matchStatus} | ${row.matchNotes.join(", ") || "-"}`;
    })
    .join("\n");
}

function buildMarkdown(summary: RosterReconciliationSummary, inputs: InputFile[]) {
  return `# Pilot Roster Reconciliation Dry-Run Evidence - ${new Date().toISOString().slice(0, 10)}

## Scope

This dry-run reads pilot roster and target workbooks into a single analysis shape.
It does not insert, update, or delete product table rows.

## Inputs

${inputs
  .map(
    (input) =>
      `- ${input.sourceKind} ${input.sourcePeriod ?? "-"}: ${basename(input.path)}`,
  )
  .join("\n")}

## Totals

| Metric | Count |
| --- | ---: |
| Rows | ${summary.totals.rows} |
| Active company roster | ${summary.totals.activeCompanyRoster} |
| Dealer reference rows | ${summary.totals.dealerReferenceRows} |
| Target rows | ${summary.totals.targetRows} |
| Sales/KPI rows | ${summary.totals.salesKpiRows} |
| Store managers | ${summary.totals.storeManagers} |
| Cashiers | ${summary.totals.cashiers} |
| Monthly leaver candidates | ${summary.totals.monthlyLeavers} |
| Matched targets | ${summary.totals.matchedTargets} |
| Unmatched targets | ${summary.totals.unmatchedTargets} |
| Missing store candidates | ${summary.totals.missingStores} |
| Risky matches | ${summary.totals.riskyMatches} |

## Sections

### Active Company Roster

${sectionRows(summary, "activeCompanyRoster")}

### Missing Stores

${sectionRows(summary, "missingStores")}

### External Map Candidates

${sectionRows(summary, "externalMapCandidates")}

### Monthly Leavers

${sectionRows(summary, "monthlyLeavers")}

### Target Matches

${sectionRows(summary, "targetMatches")}

### Unmatched Targets

${sectionRows(summary, "unmatchedTargets")}

### Cashiers

${sectionRows(summary, "cashiers")}

### Store Managers

${sectionRows(summary, "storeManagers")}

### Risky Matches

${sectionRows(summary, "riskyMatches")}

## Guardrail

No normalized product table was mutated by this script. PR2 must consume only an approved dry-run output.
`;
}

function main() {
  const { inputs, outputPath, jsonOnly } = parseArgs(process.argv.slice(2));
  if (inputs.length === 0) {
    throw new Error("No input files found. Pass explicit files or set PILOT_ROSTER_INPUT_DIR.");
  }

  const rows = inputs.flatMap(parseInputFile);
  const summary = buildRosterReconciliationDryRun(rows);

  if (jsonOnly) {
    console.log(JSON.stringify({ inputs, summary }, null, 2));
    return;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buildMarkdown(summary, inputs), "utf8");
  console.log(`Dry-run evidence written to ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        rows: summary.totals.rows,
        activeCompanyRoster: summary.totals.activeCompanyRoster,
        targetRows: summary.totals.targetRows,
        monthlyLeavers: summary.totals.monthlyLeavers,
        riskyMatches: summary.totals.riskyMatches,
      },
      null,
      2,
    ),
  );
}

main();
