import { Type } from "class-transformer";
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsInt, IsNotEmpty,
  IsIn, IsString, Max, MaxLength, Min, ValidateNested,
} from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateVmReferenceDraftDto {
  @IsPostgresUuid() companyId!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) referenceCode!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) referenceName!: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) instructions!: string;
}

export class UpsertVmReferenceItemDto {
  @IsPostgresUuid() companyId!: string;
  @IsPostgresUuid() templateId!: string;
  @IsPostgresUuid() templateItemId!: string;
  @IsInt() @Min(0) itemOrder!: number;
  @IsString() @IsNotEmpty() @MaxLength(1000) expectedVisualIntent!: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) reviewInstructions!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) rubricVersion!: string;
  @IsInt() @Min(0) expectedRevision!: number;
}

export class PublishVmReferenceDto {
  @IsPostgresUuid() companyId!: string;
  @IsInt() @Min(0) expectedRevision!: number;
  @IsPostgresUuid() idempotencyKey!: string;
  @IsDateString({ strict: true }) startsOn!: string;
  @IsDateString({ strict: true }) endsOn!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsPostgresUuid({ each: true }) storeIds!: string[];
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}

export class VmCampaignSubmissionItemDto {
  @IsPostgresUuid() referenceItemId!: string;
  @IsPostgresUuid() mediaAssetId!: string;
}

export class SubmitVmCampaignDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsPostgresUuid() idempotencyKey!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => VmCampaignSubmissionItemDto)
  items!: VmCampaignSubmissionItemDto[];
}

export class VmReferenceListQueryDto {
  @IsPostgresUuid() companyId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @Type(() => Number) @IsInt() @Min(0) offset = 0;
}

export class VmCampaignListQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @Type(() => Number) @IsInt() @Min(0) offset = 0;
}

export class ReviseVmCampaignDto {
  @IsPostgresUuid() companyId!: string;
  @IsIn(["extend", "reopen", "scope_add"])
  command!: "extend" | "reopen" | "scope_add";
  @IsInt() @Min(1) expectedRevision!: number;
  @IsPostgresUuid() idempotencyKey!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
  @IsDateString({ strict: true }) startsOn!: string;
  @IsDateString({ strict: true }) endsOn!: string;
  @IsArray() @ArrayMaxSize(500) @IsPostgresUuid({ each: true }) storeIds!: string[];
}

export class ChangeVmAssignmentStateDto {
  @IsPostgresUuid() companyId!: string;
  @IsIn(["withdraw", "exempt", "hold", "reconcile"])
  command!: "withdraw" | "exempt" | "hold" | "reconcile";
  @IsInt() @Min(0) expectedVersion!: number;
  @IsPostgresUuid() idempotencyKey!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}

export class RetireVmReferenceDto {
  @IsPostgresUuid() companyId!: string;
  @IsInt() @Min(1) expectedRevision!: number;
  @IsPostgresUuid() idempotencyKey!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
