import type { FeedVisibilityScopeType } from "../../application/feed.contract";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateFeedPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  linkLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  linkUrl?: string | null;

  @IsOptional()
  @IsIn(["company", "region", "store"])
  visibilityScopeType?: FeedVisibilityScopeType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibilityScopeIds?: string[];

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  metricCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  metricLabel?: string | null;

  @IsOptional()
  @IsDateString()
  challengeStartsOn?: string | null;

  @IsOptional()
  @IsDateString()
  challengeEndsOn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  targetRoute?: string | null;
}
