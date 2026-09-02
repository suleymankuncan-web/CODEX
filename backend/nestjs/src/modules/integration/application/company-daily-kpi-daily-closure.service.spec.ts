import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import { IntegrationModule } from "../integration.module";
import { CompanyDailyKpiDailyClosureService } from "./company-daily-kpi-daily-closure.service";

const sourceCode = "source-A";
const businessDate = "2026-08-30" as const;
const sourceId = "00000000-0000-4000-8000-000000000001";

const succeeded = (operation: "sales" | "footfall" | "gsm") => ({
  operation,
  sourceCode,
  businessDate,
  status: "succeeded" as const,
  aggregateCount: operation === "sales" ? 3 : operation === "footfall" ? 2 : 1,
  retryCount: 0,
  sanitizedSetDigest: `${operation === "sales" ? "a" : operation === "footfall" ? "b" : "c"}${"a".repeat(63)}`,
});

const failed = (operation: "sales" | "footfall" | "gsm") => ({
  operation,
  sourceCode,
  businessDate,
  status: "failed" as const,
  aggregateCount: 0,
  retryCount: 1,
  safeReasonCode: "component_unavailable",
});

const input = () => ({
  integrationSourceId: sourceId,
  businessDate,
});

describe("CompanyDailyKpiDailyClosureService", () => {
  it("delegates one strict read and evaluates an empty source as incomplete", async () => {
    const readDailyClosure = jest.fn(async () => ({
      sourceCode,
      businessDate,
      outcomes: [],
    }));
    const service = new CompanyDailyKpiDailyClosureService({
      readDailyClosure,
    } as never);

    await expect(service.readDailyClosure(input())).resolves.toEqual({
      sourceCode,
      businessDate,
      closureStatus: "incomplete",
      components: [],
      missingOperations: ["sales", "footfall", "gsm"],
    });
    expect(readDailyClosure).toHaveBeenCalledTimes(1);
    expect(readDailyClosure).toHaveBeenCalledWith(input());
  });

  it("preserves failed and succeeded metadata while evaluating closure in fixed order", async () => {
    const readDailyClosure = jest.fn(async () => ({
      sourceCode,
      businessDate,
      outcomes: [failed("footfall"), succeeded("gsm"), succeeded("sales")],
    }));
    const service = new CompanyDailyKpiDailyClosureService({
      readDailyClosure,
    } as never);

    await expect(service.readDailyClosure(input())).resolves.toEqual({
      sourceCode,
      businessDate,
      closureStatus: "incomplete",
      components: [succeeded("sales"), failed("footfall"), succeeded("gsm")],
      missingOperations: [],
    });
  });

  it("marks all three successful outcomes completed", async () => {
    const readDailyClosure = jest.fn(async () => ({
      sourceCode,
      businessDate,
      outcomes: [succeeded("gsm"), succeeded("sales"), succeeded("footfall")],
    }));
    const service = new CompanyDailyKpiDailyClosureService({
      readDailyClosure,
    } as never);

    await expect(service.readDailyClosure(input())).resolves.toMatchObject({
      closureStatus: "completed",
      missingOperations: [],
    });
  });

  it("rejects malformed input before repository access", async () => {
    const readDailyClosure = jest.fn(async () => ({
      sourceCode,
      businessDate,
      outcomes: [],
    }));
    const service = new CompanyDailyKpiDailyClosureService({
      readDailyClosure,
    } as never);

    await expect(
      service.readDailyClosure({
        integrationSourceId: "not-a-uuid",
        businessDate,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.readDailyClosure({
        integrationSourceId: sourceId,
        businessDate: "2026-02-30",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(readDailyClosure).not.toHaveBeenCalled();
  });

  it("projects no private repository fields through evaluator", async () => {
    const readDailyClosure = jest.fn(async () => ({
      sourceCode,
      businessDate,
      outcomes: [
        {
          ...succeeded("sales"),
          componentOutcomeId: "outcome-A",
          invoiceId: "invoice-A",
          providerEndpoint: "https://private.invalid",
        },
      ],
    }));
    const service = new CompanyDailyKpiDailyClosureService({
      readDailyClosure,
    } as never);

    const result = await service.readDailyClosure(input());
    expect(result.components).toEqual([succeeded("sales")]);
    expect(JSON.stringify(result)).not.toMatch(/outcome-A|invoice-A|private\.invalid/i);
  });

  it("registers the application service as a provider and export", () => {
    const providers = Reflect.getMetadata("providers", IntegrationModule) as unknown[];
    const exports = Reflect.getMetadata("exports", IntegrationModule) as unknown[];
    expect(providers).toContain(CompanyDailyKpiDailyClosureService);
    expect(exports).toContain(CompanyDailyKpiDailyClosureService);
  });
});
