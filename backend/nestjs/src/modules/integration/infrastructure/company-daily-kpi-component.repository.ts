import { BadRequestException, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";

type CommonReplacement = {
  integrationSourceId: string;
  businessDate: string;
  aggregateCount: number;
  retryCount: number;
  sanitizedSetDigest: string;
  safeReasonCode?: string;
};

type EmployeeSalesFact = {
  storeId: string;
  employeeId: string;
  saleInvoiceCount: number;
  returnInvoiceCount: number;
  saleQuantity: string;
  signedReturnQuantity: string;
  netQuantity: string;
  saleAmountTry: string;
  signedReturnAmountTry: string;
  netAmountTry: string;
};

type StoreSalesFact = {
  storeId: string;
  saleInvoiceCount: number;
  returnInvoiceCount: number;
};

type StoreFootfallFact = {
  storeId: string;
  footfall: number;
};

type StoreGsmFact = {
  storeId: string;
  yesCustomerCount: number;
  totalCustomerCount: number;
};

export type CompanyDailyKpiComponentReplacement =
  | (CommonReplacement & {
      operation: "sales";
      employeeSales: EmployeeSalesFact[];
      storeSales: StoreSalesFact[];
    })
  | (CommonReplacement & {
      operation: "footfall";
      storeFootfall: StoreFootfallFact[];
    })
  | (CommonReplacement & {
      operation: "gsm";
      storeGsm: StoreGsmFact[];
    });

type ParsedDecimal = { units: bigint; scale: number };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_REASON_PATTERN = /^[a-z0-9_]{1,64}$/;
const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;
const MAX_DECIMAL_DIGITS = 38;
const MAX_DECIMAL_SCALE = 12;
const MAX_POSTGRES_INTEGER = 2_147_483_647;

@Injectable()
export class CompanyDailyKpiComponentRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async replaceSuccessfulComponentSet(
    input: CompanyDailyKpiComponentReplacement,
  ) {
    this.assertCompleteReplacement(input);

    const storeIds = this.collectStoreIds(input);
    const employeeIds =
      input.operation === "sales"
        ? [
            ...new Set(input.employeeSales.map((fact) => fact.employeeId)),
          ].sort()
        : [];

    return this.databaseService.withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [
        `company-daily-kpi:${input.integrationSourceId}:${input.businessDate}:${input.operation}`,
      ]);

      await this.assertActiveSource(client, input.integrationSourceId);
      await this.assertEnabledStores(client, storeIds);
      await this.assertEmployeesExist(client, employeeIds);

      const deleted = await client.query(
        `
          DELETE FROM ops.company_daily_kpi_component_outcome
          WHERE integration_source_id = $1::uuid
            AND business_date = $2::date
            AND operation = $3
        `,
        [input.integrationSourceId, input.businessDate, input.operation],
      );

      const outcome = await client.query<{ component_outcome_id: string }>(
        `
          INSERT INTO ops.company_daily_kpi_component_outcome (
            integration_source_id,
            business_date,
            operation,
            status,
            aggregate_count,
            retry_count,
            safe_reason_code,
            sanitized_set_digest
          )
          VALUES ($1::uuid, $2::date, $3, 'succeeded', $4, $5, $6, $7)
          RETURNING component_outcome_id
        `,
        [
          input.integrationSourceId,
          input.businessDate,
          input.operation,
          input.aggregateCount,
          input.retryCount,
          input.safeReasonCode ?? null,
          input.sanitizedSetDigest,
        ],
      );
      const componentOutcomeId = outcome.rows[0]?.component_outcome_id;
      if (!componentOutcomeId) {
        throw new Error("company_daily_kpi_outcome_insert_failed");
      }

      await this.insertTypedFacts(client, componentOutcomeId, input);

      return {
        componentOutcomeId,
        replaced: (deleted.rowCount ?? 0) > 0,
      };
    });
  }

  private async assertActiveSource(
    client: PoolClient,
    integrationSourceId: string,
  ) {
    const result = await client.query<{ integration_source_id: string }>(
      `
        SELECT integration_source_id
        FROM stg.integration_source
        WHERE integration_source_id = $1::uuid
          AND is_active = TRUE
        FOR SHARE
      `,
      [integrationSourceId],
    );
    if (result.rows.length !== 1) {
      throw new BadRequestException("company_daily_kpi_source_not_active");
    }
  }

  private async assertEnabledStores(client: PoolClient, storeIds: string[]) {
    if (storeIds.length === 0) return;
    const result = await client.query<{ store_id: string }>(
      `
        SELECT store_id
        FROM ops.store
        WHERE store_id = ANY($1::uuid[])
          AND status = 'active'
          AND kpi_import_enabled = TRUE
        FOR SHARE
      `,
      [storeIds],
    );
    if (result.rows.length !== storeIds.length) {
      throw new BadRequestException("company_daily_kpi_store_not_enabled");
    }
  }

  private async assertEmployeesExist(
    client: PoolClient,
    employeeIds: string[],
  ) {
    if (employeeIds.length === 0) return;
    const result = await client.query<{ employee_id: string }>(
      `
        SELECT employee_id
        FROM ops.employee
        WHERE employee_id = ANY($1::uuid[])
        FOR KEY SHARE
      `,
      [employeeIds],
    );
    if (result.rows.length !== employeeIds.length) {
      throw new BadRequestException("company_daily_kpi_employee_not_mapped");
    }
  }

  private async insertTypedFacts(
    client: PoolClient,
    componentOutcomeId: string,
    input: CompanyDailyKpiComponentReplacement,
  ) {
    if (input.operation === "sales") {
      if (input.employeeSales.length > 0) {
        await client.query(
          `
            INSERT INTO ops.company_daily_kpi_employee_sales (
              component_outcome_id, business_date, store_id, employee_id,
              sale_invoice_count, return_invoice_count,
              sale_quantity, signed_return_quantity, net_quantity,
              sale_amount_try, signed_return_amount_try, net_amount_try
            )
            SELECT $1::uuid, $2::date, fact.store_id, fact.employee_id,
                   fact.sale_invoice_count, fact.return_invoice_count,
                   fact.sale_quantity, fact.signed_return_quantity, fact.net_quantity,
                   fact.sale_amount_try, fact.signed_return_amount_try, fact.net_amount_try
            FROM jsonb_to_recordset($3::jsonb) AS fact(
              store_id uuid, employee_id uuid,
              sale_invoice_count integer, return_invoice_count integer,
              sale_quantity numeric(38,12), signed_return_quantity numeric(38,12),
              net_quantity numeric(38,12), sale_amount_try numeric(38,12),
              signed_return_amount_try numeric(38,12), net_amount_try numeric(38,12)
            )
          `,
          [
            componentOutcomeId,
            input.businessDate,
            JSON.stringify(
              input.employeeSales.map((fact) => ({
                employee_id: fact.employeeId,
                net_amount_try: fact.netAmountTry,
                net_quantity: fact.netQuantity,
                return_invoice_count: fact.returnInvoiceCount,
                sale_amount_try: fact.saleAmountTry,
                sale_invoice_count: fact.saleInvoiceCount,
                sale_quantity: fact.saleQuantity,
                signed_return_amount_try: fact.signedReturnAmountTry,
                signed_return_quantity: fact.signedReturnQuantity,
                store_id: fact.storeId,
              })),
            ),
          ],
        );
      }
      if (input.storeSales.length > 0) {
        await client.query(
          `
            INSERT INTO ops.company_daily_kpi_store_sales (
              component_outcome_id, business_date, store_id,
              sale_invoice_count, return_invoice_count
            )
            SELECT $1::uuid, $2::date, fact.store_id,
                   fact.sale_invoice_count, fact.return_invoice_count
            FROM jsonb_to_recordset($3::jsonb) AS fact(
              store_id uuid, sale_invoice_count integer, return_invoice_count integer
            )
          `,
          [
            componentOutcomeId,
            input.businessDate,
            JSON.stringify(
              input.storeSales.map((fact) => ({
                return_invoice_count: fact.returnInvoiceCount,
                sale_invoice_count: fact.saleInvoiceCount,
                store_id: fact.storeId,
              })),
            ),
          ],
        );
      }
      return;
    }

    if (input.operation === "footfall") {
      if (input.storeFootfall.length > 0) {
        await client.query(
          `
            INSERT INTO ops.company_daily_kpi_store_footfall (
              component_outcome_id, business_date, store_id, footfall
            )
            SELECT $1::uuid, $2::date, fact.store_id, fact.footfall
            FROM jsonb_to_recordset($3::jsonb) AS fact(store_id uuid, footfall bigint)
          `,
          [
            componentOutcomeId,
            input.businessDate,
            JSON.stringify(
              input.storeFootfall.map((fact) => ({
                footfall: fact.footfall,
                store_id: fact.storeId,
              })),
            ),
          ],
        );
      }
      return;
    }

    if (input.storeGsm.length > 0) {
      await client.query(
        `
          INSERT INTO ops.company_daily_kpi_store_gsm (
            component_outcome_id, business_date, store_id,
            yes_customer_count, total_customer_count
          )
          SELECT $1::uuid, $2::date, fact.store_id,
                 fact.yes_customer_count, fact.total_customer_count
          FROM jsonb_to_recordset($3::jsonb) AS fact(
            store_id uuid, yes_customer_count bigint, total_customer_count bigint
          )
        `,
        [
          componentOutcomeId,
          input.businessDate,
          JSON.stringify(
            input.storeGsm.map((fact) => ({
              store_id: fact.storeId,
              total_customer_count: fact.totalCustomerCount,
              yes_customer_count: fact.yesCustomerCount,
            })),
          ),
        ],
      );
    }
  }

  private assertCompleteReplacement(
    input: CompanyDailyKpiComponentReplacement,
  ) {
    if (
      !UUID_PATTERN.test(input.integrationSourceId) ||
      !isIsoDate(input.businessDate) ||
      !Number.isSafeInteger(input.aggregateCount) ||
      input.aggregateCount < 0 ||
      input.aggregateCount > MAX_POSTGRES_INTEGER ||
      !Number.isSafeInteger(input.retryCount) ||
      input.retryCount < 0 ||
      input.retryCount > MAX_POSTGRES_INTEGER ||
      !DIGEST_PATTERN.test(input.sanitizedSetDigest) ||
      (input.safeReasonCode !== undefined &&
        !SAFE_REASON_PATTERN.test(input.safeReasonCode))
    ) {
      throw new BadRequestException("company_daily_kpi_invalid_replacement");
    }

    if (input.operation === "sales") {
      this.assertSalesFacts(input.employeeSales, input.storeSales);
      if (
        input.aggregateCount !==
        input.employeeSales.length + input.storeSales.length
      ) {
        throw new BadRequestException(
          "company_daily_kpi_aggregate_count_mismatch",
        );
      }
      return;
    }

    const facts =
      input.operation === "footfall" ? input.storeFootfall : input.storeGsm;
    this.assertUniqueStoreFacts(facts);
    for (const fact of facts) this.assertUuid(fact.storeId);
    if (input.aggregateCount !== facts.length) {
      throw new BadRequestException(
        "company_daily_kpi_aggregate_count_mismatch",
      );
    }

    if (input.operation === "footfall") {
      for (const fact of input.storeFootfall)
        this.assertSafeCount(fact.footfall);
    } else {
      for (const fact of input.storeGsm) {
        this.assertSafeCount(fact.yesCustomerCount);
        this.assertSafeCount(fact.totalCustomerCount);
        if (fact.yesCustomerCount > fact.totalCustomerCount) {
          throw new BadRequestException("company_daily_kpi_invalid_gsm_bounds");
        }
      }
    }
  }

  private assertSalesFacts(
    employeeFacts: EmployeeSalesFact[],
    storeFacts: StoreSalesFact[],
  ) {
    this.assertUniqueStoreFacts(storeFacts);
    const storeIds = new Set(storeFacts.map((fact) => fact.storeId));
    const employeeGrains = new Set<string>();

    for (const fact of storeFacts) {
      this.assertUuid(fact.storeId);
      this.assertCount(fact.saleInvoiceCount);
      this.assertCount(fact.returnInvoiceCount);
    }

    for (const fact of employeeFacts) {
      this.assertUuid(fact.storeId);
      this.assertUuid(fact.employeeId);
      this.assertCount(fact.saleInvoiceCount);
      this.assertCount(fact.returnInvoiceCount);
      if (!storeIds.has(fact.storeId)) {
        throw new BadRequestException(
          "company_daily_kpi_employee_store_missing",
        );
      }
      const grain = `${fact.storeId}:${fact.employeeId}`;
      if (employeeGrains.has(grain)) {
        throw new BadRequestException(
          "company_daily_kpi_duplicate_employee_grain",
        );
      }
      employeeGrains.add(grain);

      const saleQuantity = parseDecimal(fact.saleQuantity);
      const returnQuantity = parseDecimal(fact.signedReturnQuantity);
      const netQuantity = parseDecimal(fact.netQuantity);
      const saleAmount = parseDecimal(fact.saleAmountTry);
      const returnAmount = parseDecimal(fact.signedReturnAmountTry);
      const netAmount = parseDecimal(fact.netAmountTry);
      if (
        saleQuantity.units < 0n ||
        saleAmount.units < 0n ||
        returnQuantity.units > 0n ||
        returnAmount.units > 0n ||
        !equalsDecimalSum(saleQuantity, returnQuantity, netQuantity) ||
        !equalsDecimalSum(saleAmount, returnAmount, netAmount)
      ) {
        throw new BadRequestException("company_daily_kpi_invalid_sales_totals");
      }
    }
  }

  private assertUniqueStoreFacts(facts: Array<{ storeId: string }>) {
    const storeIds = facts.map((fact) => fact.storeId);
    if (new Set(storeIds).size !== storeIds.length) {
      throw new BadRequestException("company_daily_kpi_duplicate_store_grain");
    }
  }

  private assertCount(value: number) {
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > MAX_POSTGRES_INTEGER
    ) {
      throw new BadRequestException("company_daily_kpi_invalid_count");
    }
  }

  private assertSafeCount(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new BadRequestException("company_daily_kpi_invalid_count");
    }
  }

  private assertUuid(value: string) {
    if (!UUID_PATTERN.test(value)) {
      throw new BadRequestException("company_daily_kpi_unmapped_identity");
    }
  }

  private collectStoreIds(input: CompanyDailyKpiComponentReplacement) {
    const ids =
      input.operation === "sales"
        ? [
            ...input.storeSales.map((fact) => fact.storeId),
            ...input.employeeSales.map((fact) => fact.storeId),
          ]
        : input.operation === "footfall"
          ? input.storeFootfall.map((fact) => fact.storeId)
          : input.storeGsm.map((fact) => fact.storeId);
    return [...new Set(ids)].sort();
  }
}

function isIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function parseDecimal(value: string): ParsedDecimal {
  const match = DECIMAL_PATTERN.exec(value);
  if (!match)
    throw new BadRequestException("company_daily_kpi_invalid_decimal");
  const integerDigits = match[2].replace(/^0+(?=\d)/, "");
  const fractionalDigits = match[3] ?? "";
  if (
    integerDigits.length + fractionalDigits.length > MAX_DECIMAL_DIGITS ||
    fractionalDigits.length > MAX_DECIMAL_SCALE
  ) {
    throw new BadRequestException("company_daily_kpi_decimal_out_of_range");
  }
  return {
    units: BigInt(`${match[1]}${integerDigits}${fractionalDigits}`),
    scale: fractionalDigits.length,
  };
}

function equalsDecimalSum(
  left: ParsedDecimal,
  right: ParsedDecimal,
  expected: ParsedDecimal,
) {
  const scale = Math.max(left.scale, right.scale, expected.scale);
  const align = (value: ParsedDecimal) =>
    value.units * 10n ** BigInt(scale - value.scale);
  return align(left) + align(right) === align(expected);
}
