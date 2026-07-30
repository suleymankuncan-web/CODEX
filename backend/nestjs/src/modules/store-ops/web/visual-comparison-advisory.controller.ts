import { BadRequestException, Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, StreamableFile } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { VisualComparisonAdvisoryService } from "../application/visual-comparison-advisory.service";
import { VisualComparisonAdvisoryListDto, VisualComparisonAdvisoryReviewDto } from "./dto/visual-comparison-advisory.dto";

type Request = { user: AuthenticatedUser };

@Controller("visual-comparisons/advisories")
@RequireScope("authenticated")
@RequireRoles("REGION_MANAGER")
export class VisualComparisonAdvisoryController {
  constructor(private readonly service: VisualComparisonAdvisoryService) {}

  @Get()
  list(@Req() request: Request, @Query() query: VisualComparisonAdvisoryListDto) {
    return this.service.list(request.user, query);
  }

  @Get(":comparisonRunId")
  detail(@Req() request: Request, @Param("comparisonRunId", new ParseUUIDPipe()) comparisonRunId: string) {
    return this.service.detail(request.user, comparisonRunId);
  }

  @Get(":comparisonRunId/media/:kind/thumbnail")
  @Header("Cache-Control", "private, no-store")
  async media(@Req() request: Request,
    @Param("comparisonRunId", new ParseUUIDPipe()) comparisonRunId: string,
    @Param("kind") kind: "reference" | "evidence") {
    if (!(["reference", "evidence"] as string[]).includes(kind)) throw new BadRequestException("Unsupported advisory media kind");
    const content = await this.service.mediaContent(request.user, comparisonRunId, kind);
    return new StreamableFile(content.body, { type: content.contentType });
  }

  @Post(":comparisonRunId/reviews")
  review(@Req() request: Request,
    @Param("comparisonRunId", new ParseUUIDPipe()) comparisonRunId: string,
    @Body() body: VisualComparisonAdvisoryReviewDto) {
    return this.service.review(request.user, comparisonRunId, body);
  }
}
