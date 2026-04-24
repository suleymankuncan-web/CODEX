import "reflect-metadata";

type JsonObject = Record<string, unknown>;
type SmokeHeaders = Record<string, string>;

export type StoreMeSmokeConfig = {
  baseUrl: string;
  token?: string;
  userId: string;
  employeeId: string;
  expectedEmployeeId: string;
  roleCodes: string;
  companyId: string;
  regionId: string;
  storeId: string;
  requiredMetricCodes: string[];
};

export type StoreMeSmokeSummary = {
  status: "ok";
  baseUrl: string;
  employee: {
    employeeId: string | null;
    externalRef: string | null;
    displayName: string | null;
  };
  score: {
    value: number;
    matchedMetrics: number;
  };
  rankings: {
    turkeyRank: number;
    turkeyPopulation: number;
    storeRank: number;
    storePopulation: number;
  };
  metrics: string[];
};

const defaultCompanyId = "00000000-0000-0000-0000-000000000001";
const defaultRegionId = "00000000-0000-0000-0000-000000000010";
const defaultStoreId = "00000000-0000-0000-0000-000000000100";
const defaultExpectedEmployeeId = "00000000-0000-0000-0000-000000000202";
const defaultRequiredMetricCodes = ["TARGET_ACHIEVEMENT", "ATV", "UPT"];

export function createStoreMeSmokeConfig(
  env: NodeJS.ProcessEnv = process.env,
): StoreMeSmokeConfig {
  return {
    baseUrl:
      env.STORE_ME_SMOKE_BASE_URL ?? env.SMOKE_BASE_URL ?? "http://localhost:3000/api",
    token: env.STORE_ME_SMOKE_TOKEN ?? env.SMOKE_AUTH_TOKEN,
    userId: env.STORE_ME_SMOKE_USER_ID ?? "store-me-smoke-user",
    employeeId: env.STORE_ME_SMOKE_EMPLOYEE_ID ?? "DEMO-EMP-202",
    expectedEmployeeId:
      env.STORE_ME_SMOKE_EXPECTED_EMPLOYEE_ID ?? defaultExpectedEmployeeId,
    roleCodes: env.STORE_ME_SMOKE_ROLE_CODES ?? "STORE_PERSONNEL",
    companyId: env.STORE_ME_SMOKE_COMPANY_ID ?? defaultCompanyId,
    regionId: env.STORE_ME_SMOKE_REGION_ID ?? defaultRegionId,
    storeId: env.STORE_ME_SMOKE_STORE_ID ?? defaultStoreId,
    requiredMetricCodes: parseRequiredMetricCodes(
      env.STORE_ME_SMOKE_REQUIRED_METRICS,
    ),
  };
}

export function buildStoreMeSmokeHeaders(config: StoreMeSmokeConfig): SmokeHeaders {
  if (config.token) {
    return {
      authorization: `Bearer ${config.token}`,
    };
  }

  return {
    "x-user-id": config.userId,
    "x-employee-id": config.employeeId,
    "x-role-codes": config.roleCodes,
    "x-company-ids": config.companyId,
    "x-region-ids": config.regionId,
    "x-store-ids": config.storeId,
    "x-read-company-ids": config.companyId,
    "x-read-region-ids": config.regionId,
    "x-read-store-ids": config.storeId,
    "x-assigned-store-ids": config.storeId,
  };
}

export function assertStoreMeSmokeResponse(
  body: unknown,
  config: StoreMeSmokeConfig,
): asserts body is JsonObject {
  assertCondition(isObject(body), "Store-me smoke response was not an object");

  const source = readObject(body, "source");
  assertCondition(source?.mode === "live", "Store-me smoke response was not in live mode");

  const employee = readObject(body, "employee");
  assertCondition(employee, "Store-me smoke response did not include employee");
  if (config.expectedEmployeeId) {
    assertCondition(
      employee.employeeId === config.expectedEmployeeId,
      `Store-me smoke response employeeId ${String(
        employee.employeeId,
      )} did not match ${config.expectedEmployeeId}`,
    );
  }

  const score = readObject(body, "score");
  assertCondition(score, "Store-me smoke response did not include score");
  assertFiniteNumber(score.value, "Store-me smoke response did not include a numeric score.value");
  assertCondition(score.value > 0, "Store-me smoke response score.value was not positive");
  assertFiniteNumber(
    score.matchedMetrics,
    "Store-me smoke response did not include numeric score.matchedMetrics",
  );
  assertCondition(
    score.matchedMetrics >= config.requiredMetricCodes.length,
    `Store-me smoke response matched ${String(score.matchedMetrics)} metrics, expected at least ${
      config.requiredMetricCodes.length
    }`,
  );

  const metrics = Array.isArray(body.metrics) ? body.metrics : null;
  assertCondition(metrics, "Store-me smoke response did not include metrics");

  for (const metricCode of config.requiredMetricCodes) {
    const metric = metrics.find(
      (candidate): candidate is JsonObject =>
        isObject(candidate) && candidate.metricCode === metricCode,
    );
    assertCondition(
      metric,
      `Store-me smoke response did not include ${metricCode} metric`,
    );
    assertMetricIsReady(metric, metricCode);
  }

  const rankings = readObject(body, "rankings");
  assertCondition(rankings, "Store-me smoke response did not include rankings");
  assertPositiveRank(rankings, "turkeyRank");
  assertPositivePopulation(rankings, "turkeyPopulation");
  assertPositiveRank(rankings, "storeRank");
  assertPositivePopulation(rankings, "storePopulation");
}

export function buildStoreMeSmokeSummary(
  body: JsonObject,
  config: StoreMeSmokeConfig,
): StoreMeSmokeSummary {
  const employee = readObject(body, "employee") ?? {};
  const score = readObject(body, "score") ?? {};
  const rankings = readObject(body, "rankings") ?? {};
  const metrics = Array.isArray(body.metrics) ? body.metrics : [];

  return {
    status: "ok",
    baseUrl: config.baseUrl,
    employee: {
      employeeId: readNullableString(employee.employeeId),
      externalRef: readNullableString(employee.externalRef),
      displayName: readNullableString(employee.displayName),
    },
    score: {
      value: readNumber(score.value),
      matchedMetrics: readNumber(score.matchedMetrics),
    },
    rankings: {
      turkeyRank: readNumber(rankings.turkeyRank),
      turkeyPopulation: readNumber(rankings.turkeyPopulation),
      storeRank: readNumber(rankings.storeRank),
      storePopulation: readNumber(rankings.storePopulation),
    },
    metrics: metrics
      .map((metric) =>
        isObject(metric) && typeof metric.metricCode === "string"
          ? metric.metricCode
          : null,
      )
      .filter((metricCode): metricCode is string =>
        config.requiredMetricCodes.includes(metricCode ?? ""),
      ),
  };
}

async function main() {
  const config = createStoreMeSmokeConfig();
  const body = await requestJson(config, "/reports/my-performance?mode=live", {
    headers: buildStoreMeSmokeHeaders(config),
  });

  assertStoreMeSmokeResponse(body, config);
  console.log(JSON.stringify(buildStoreMeSmokeSummary(body, config), null, 2));
}

async function requestJson(
  config: StoreMeSmokeConfig,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${config.baseUrl}${path}`, init);
  const body = (await response.json().catch(() => ({}))) as JsonObject;

  if (!response.ok) {
    throw new Error(
      `Store-me smoke check failed for ${path}: ${response.status} ${
        response.statusText
      } ${JSON.stringify(body)}`,
    );
  }

  return body;
}

function parseRequiredMetricCodes(value: string | undefined) {
  if (!value) {
    return defaultRequiredMetricCodes;
  }

  const metricCodes = value
    .split(",")
    .map((metricCode) => metricCode.trim())
    .filter(Boolean);

  return metricCodes.length > 0 ? metricCodes : defaultRequiredMetricCodes;
}

function assertMetricIsReady(metric: JsonObject, metricCode: string) {
  assertCondition(
    metric.actualValue !== null && metric.actualValue !== undefined,
    `Store-me smoke response ${metricCode} metric did not include actualValue`,
  );
  assertCondition(
    metric.dataStatus !== "missing",
    `Store-me smoke response ${metricCode} metric dataStatus was missing`,
  );
  assertCondition(
    metric.scoreStatus === "scored",
    `Store-me smoke response ${metricCode} metric was not scored`,
  );
}

function assertPositiveRank(rankings: JsonObject, field: string) {
  assertFiniteNumber(
    rankings[field],
    `Store-me smoke response did not include a numeric ${field}`,
  );
  assertCondition(
    readNumber(rankings[field]) > 0,
    `Store-me smoke response ${field} was not positive`,
  );
}

function assertPositivePopulation(rankings: JsonObject, field: string) {
  assertFiniteNumber(
    rankings[field],
    `Store-me smoke response did not include a numeric ${field}`,
  );
  assertCondition(
    readNumber(rankings[field]) > 0,
    `Store-me smoke response ${field} was not positive`,
  );
}

function assertFiniteNumber(value: unknown, message: string): asserts value is number {
  assertCondition(typeof value === "number" && Number.isFinite(value), message);
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readObject(source: JsonObject, key: string) {
  const value = source[key];
  return isObject(value) ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
