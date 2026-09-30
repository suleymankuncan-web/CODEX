import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class GetStoreReturnsQueryDto {
  @ApiProperty({ format: "uuid" })
  @IsPostgresUuid()
  storeId!: string;

  @ApiProperty({ format: "date" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart!: string;

  @ApiProperty({ format: "date" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodEnd!: string;

  @ApiPropertyOptional({ enum: ["inside", "other"], default: "inside" })
  @IsOptional()
  @IsIn(["inside", "other"])
  category?: "inside" | "other";

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  offset?: number;
}
