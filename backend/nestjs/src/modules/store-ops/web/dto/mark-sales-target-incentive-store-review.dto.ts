import { IsIn, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class MarkSalesTargetIncentiveStoreReviewDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @IsPostgresUuid()
  storeId!: string;

  @IsIn(["pending_review", "reviewed"])
  reviewStatus!: "pending_review" | "reviewed";
}
