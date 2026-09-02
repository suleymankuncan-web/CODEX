import { BadRequestException, Injectable } from "@nestjs/common";
import {
  evaluateCompanyDailyKpiDailyClosure,
  type CompanyDailyKpiDailyClosureResult,
} from "./company-daily-kpi-daily-closure";
import {
  CompanyDailyKpiDailyClosureReadRepository,
  type CompanyDailyKpiDailyClosureReadInput,
} from "../infrastructure/company-daily-kpi-daily-closure-read.repository";

export type CompanyDailyKpiDailyClosureServiceInput =
  CompanyDailyKpiDailyClosureReadInput;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class CompanyDailyKpiDailyClosureService {
  constructor(
    private readonly dailyClosureReadRepository: CompanyDailyKpiDailyClosureReadRepository,
  ) {}

  async readDailyClosure(
    input: CompanyDailyKpiDailyClosureServiceInput,
  ): Promise<CompanyDailyKpiDailyClosureResult> {
    assertReadInput(input);
    const read = await this.dailyClosureReadRepository.readDailyClosure(input);
    return evaluateCompanyDailyKpiDailyClosure({
      sourceCode: read.sourceCode,
      businessDate: read.businessDate,
      outcomes: read.outcomes,
    });
  }
}

function assertReadInput(
  input: CompanyDailyKpiDailyClosureServiceInput,
): void {
  if (!isStrictRecord(input)) {
    throw invalidInput("company_daily_kpi_invalid_daily_closure_input");
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== 2 ||
    keys.some(
      (key) => key !== "integrationSourceId" && key !== "businessDate",
    )
  ) {
    throw invalidInput("company_daily_kpi_invalid_daily_closure_input");
  }
  const sourceId = readOwnValue(input, "integrationSourceId");
  const businessDate = readOwnValue(input, "businessDate");
  if (typeof sourceId !== "string" || !UUID_PATTERN.test(sourceId)) {
    throw invalidInput("company_daily_kpi_invalid_daily_closure_source_id");
  }
  if (typeof businessDate !== "string" || !isIsoDate(businessDate)) {
    throw invalidInput("company_daily_kpi_invalid_daily_closure_date");
  }
}

function isStrictRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOwnValue(record: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw invalidInput("company_daily_kpi_invalid_daily_closure_input");
  }
  return descriptor.value;
}

function isIsoDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return day <= (leap ? 29 : 28);
  }
  return day <= ([4, 6, 9, 11].includes(month) ? 30 : 31);
}

function invalidInput(code: string): BadRequestException {
  return new BadRequestException(code);
}
