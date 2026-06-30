import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MasterDataQualityListMetaDto {
  @ApiProperty()
  count!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}

export class MasterDataQualityIssueItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  issueCode!: string;

  @ApiProperty({ enum: ["critical", "warning", "info"] })
  severity!: "critical" | "warning" | "info";

  @ApiProperty({ enum: ["store", "personnel", "assignment", "import"] })
  entityType!: "store" | "personnel" | "assignment" | "import";

  @ApiProperty()
  entityId!: string;

  @ApiProperty()
  entityLabel!: string;

  @ApiPropertyOptional({ nullable: true })
  secondaryLabel!: string | null;

  @ApiProperty()
  problemLabel!: string;

  @ApiProperty()
  recommendedAction!: string;

  @ApiProperty({ type: [String] })
  affectedModules!: string[];

  @ApiProperty()
  lastSeenAt!: string;

  @ApiProperty()
  source!: string;
}

export class MasterDataQualityIssueSeveritySummaryDto {
  @ApiProperty()
  critical!: number;

  @ApiProperty()
  warning!: number;

  @ApiProperty()
  info!: number;
}

export class MasterDataQualityIssueEntitySummaryDto {
  @ApiProperty()
  store!: number;

  @ApiProperty()
  personnel!: number;

  @ApiProperty()
  assignment!: number;

  @ApiProperty()
  import!: number;
}

export class MasterDataQualityIssueSummaryDto {
  @ApiProperty({ type: MasterDataQualityIssueSeveritySummaryDto })
  severity!: MasterDataQualityIssueSeveritySummaryDto;

  @ApiProperty({ type: MasterDataQualityIssueEntitySummaryDto })
  entityType!: MasterDataQualityIssueEntitySummaryDto;
}

export class MasterDataQualityIssuesResponseDto {
  @ApiProperty({ type: [MasterDataQualityIssueItemDto] })
  items!: MasterDataQualityIssueItemDto[];

  @ApiProperty({ type: MasterDataQualityListMetaDto })
  meta!: MasterDataQualityListMetaDto;

  @ApiProperty({ type: MasterDataQualityIssueSummaryDto })
  summary!: MasterDataQualityIssueSummaryDto;
}

export class MasterDataQualityAuditItemDto {
  @ApiProperty()
  eventId!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty({ enum: ["store", "personnel", "import"] })
  entityType!: "store" | "personnel" | "import";

  @ApiPropertyOptional({ nullable: true })
  entityId!: string | null;

  @ApiProperty()
  entityLabel!: string;

  @ApiProperty()
  actorLabel!: string;

  @ApiProperty()
  occurredAt!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  metadata!: Record<string, unknown>;
}

export class MasterDataQualityAuditResponseDto {
  @ApiProperty({ type: [MasterDataQualityAuditItemDto] })
  items!: MasterDataQualityAuditItemDto[];

  @ApiProperty({ type: MasterDataQualityListMetaDto })
  meta!: MasterDataQualityListMetaDto;
}
