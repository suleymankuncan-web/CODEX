import type {
  FeedPostType,
  FeedPublishStatus,
  FeedVisibilityScopeType,
} from "../../application/feed.contract";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateFeedPostDto {
  @IsIn(["announcement", "challenge"])
  postType!: FeedPostType;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  linkLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  linkUrl?: string;

  @IsIn(["company", "region", "store"])
  visibilityScopeType!: FeedVisibilityScopeType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibilityScopeIds?: string[];

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsIn(["draft", "published", "archived"])
  publishStatus?: FeedPublishStatus;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  metricCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  metricLabel?: string;

  @IsOptional()
  @IsDateString()
  challengeStartsOn?: string;

  @IsOptional()
  @IsDateString()
  challengeEndsOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  targetRoute?: string;
}
