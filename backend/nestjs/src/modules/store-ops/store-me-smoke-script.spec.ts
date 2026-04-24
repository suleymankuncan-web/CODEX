import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertStoreMeSmokeResponse,
  buildStoreMeSmokeHeaders,
  buildStoreMeSmokeSummary,
  createStoreMeSmokeConfig,
} from "../../../scripts/store-me-smoke";

describe("store-me smoke script", () => {
  it("builds mock auth headers for the demo store personnel user by default", () => {
    const config = createStoreMeSmokeConfig({});

    expect(buildStoreMeSmokeHeaders(config)).toEqual({
      "x-user-id": "store-me-smoke-user",
      "x-employee-id": "DEMO-EMP-202",
      "x-role-codes": "STORE_PERSONNEL",
      "x-company-ids": "00000000-0000-0000-0000-000000000001",
      "x-region-ids": "00000000-0000-0000-0000-000000000010",
      "x-store-ids": "00000000-0000-0000-0000-000000000100",
      "x-read-company-ids": "00000000-0000-0000-0000-000000000001",
      "x-read-region-ids": "00000000-0000-0000-0000-000000000010",
      "x-read-store-ids": "00000000-0000-0000-0000-000000000100",
      "x-assigned-store-ids": "00000000-0000-0000-0000-000000000100",
    });
  });

  it("uses a bearer token instead of mock auth headers when one is provided", () => {
    const config = createStoreMeSmokeConfig({
      STORE_ME_SMOKE_TOKEN: "token-123",
    });

    expect(buildStoreMeSmokeHeaders(config)).toEqual({
      authorization: "Bearer token-123",
    });
  });

  it("accepts a healthy live store-me response", () => {
    const config = createStoreMeSmokeConfig({});
    const response = buildHealthyResponse();

    expect(() => assertStoreMeSmokeResponse(response, config)).not.toThrow();
  });

  it("rejects missing required metric rows", () => {
    const config = createStoreMeSmokeConfig({});
    const response = buildHealthyResponse({
      metrics: [
        {
          code: "TARGET_ACHIEVEMENT",
          actualValue: 98.1,
          status: "reported",
        },
        {
          code: "ATV",
          actualValue: 450,
          status: "reported",
        },
      ],
    });

    expect(() => assertStoreMeSmokeResponse(response, config)).toThrow(
      "Store-me smoke response did not include UPT metric",
    );
  });

  it("rejects responses without populated rankings", () => {
    const config = createStoreMeSmokeConfig({});
    const response = buildHealthyResponse({
      rankings: {
        turkeyRank: null,
        turkeyPopulation: 0,
        storeRank: 1,
        storePopulation: 4,
      },
    });

    expect(() => assertStoreMeSmokeResponse(response, config)).toThrow(
      "Store-me smoke response did not include a numeric turkeyRank",
    );
  });

  it("summarizes only the release-relevant details", () => {
    const config = createStoreMeSmokeConfig({});
    const summary = buildStoreMeSmokeSummary(buildHealthyResponse(), config);

    expect(summary).toEqual({
      status: "ok",
      baseUrl: "http://localhost:3000/api",
      employee: {
        employeeId: "00000000-0000-0000-0000-000000000202",
        externalRef: "DEMO-EMP-202",
        displayName: "Demo Personnel",
      },
      score: {
        value: 91.5,
        matchedMetrics: 3,
      },
      rankings: {
        turkeyRank: 7,
        turkeyPopulation: 42,
        storeRank: 1,
        storePopulation: 4,
      },
      metrics: ["TARGET_ACHIEVEMENT", "ATV", "UPT"],
    });
  });

  it("exposes the npm script entrypoint", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["smoke:store-me"]).toBe("ts-node scripts/store-me-smoke.ts");
  });

  it("runs the store-me smoke during release rehearsal", () => {
    const releaseRehearsal = readFileSync(
      join(process.cwd(), "scripts", "release-rehearsal.ts"),
      "utf8",
    );

    expect(releaseRehearsal).toContain('"smoke:release"');
    expect(releaseRehearsal).toContain('"smoke:store-me"');
  });
});

function buildHealthyResponse(overrides: Record<string, unknown> = {}) {
  return {
    source: {
      mode: "live",
    },
    employee: {
      employeeId: "00000000-0000-0000-0000-000000000202",
      externalRef: "DEMO-EMP-202",
      displayName: "Demo Personnel",
    },
    score: {
      value: 91.5,
      matchedMetrics: 3,
    },
    rankings: {
      turkeyRank: 7,
      turkeyPopulation: 42,
      storeRank: 1,
      storePopulation: 4,
    },
    metrics: [
      {
        code: "TARGET_ACHIEVEMENT",
        actualValue: 98.1,
        status: "reported",
      },
      {
        code: "ATV",
        actualValue: 450,
        status: "reported",
      },
      {
        code: "UPT",
        actualValue: 2.3,
        status: "reported",
      },
    ],
    ...overrides,
  };
}
