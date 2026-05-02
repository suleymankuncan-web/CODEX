import { Body, Controller, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { FeedService } from "../application/feed.service";
import { CreateFeedPostDto } from "./dto/create-feed-post.dto";
import { UpdateFeedPostDto } from "./dto/update-feed-post.dto";

type FeedRequest = {
  user: {
    userId: string;
    roleCodes: string[];
    scope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    readScope?: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
  };
};

@Controller()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get("feed")
  @RequireScope("authenticated")
  async listVisibleFeed(
    @Req() request: FeedRequest,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.feedService.listVisibleFeedPosts({
      ...this.actorFromRequest(request),
      limit: this.toOptionalNumber(limit),
      offset: this.toOptionalNumber(offset),
    });
  }

  @Get("admin/feed")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async listManageableFeed(
    @Req() request: FeedRequest,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.feedService.listManageableFeedPosts({
      ...this.actorFromRequest(request),
      limit: this.toOptionalNumber(limit),
      offset: this.toOptionalNumber(offset),
    });
  }

  @Post("admin/feed")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async createFeedPost(@Req() request: FeedRequest, @Body() body: CreateFeedPostDto) {
    return this.feedService.createFeedPost({
      ...this.actorFromRequest(request),
      ...body,
    });
  }

  @Put("admin/feed/:feedPostId")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async updateFeedPost(
    @Req() request: FeedRequest,
    @Param("feedPostId") feedPostId: string,
    @Body() body: UpdateFeedPostDto,
  ) {
    return this.feedService.updateFeedPost({
      ...this.actorFromRequest(request),
      feedPostId,
      ...body,
    });
  }

  @Post("admin/feed/:feedPostId/publish")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async publishFeedPost(@Req() request: FeedRequest, @Param("feedPostId") feedPostId: string) {
    return this.feedService.publishFeedPost({
      ...this.actorFromRequest(request),
      feedPostId,
    });
  }

  @Post("admin/feed/:feedPostId/pin")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async pinFeedPost(@Req() request: FeedRequest, @Param("feedPostId") feedPostId: string) {
    return this.feedService.pinFeedPost({
      ...this.actorFromRequest(request),
      feedPostId,
    });
  }

  @Post("admin/feed/:feedPostId/unpin")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async unpinFeedPost(@Req() request: FeedRequest, @Param("feedPostId") feedPostId: string) {
    return this.feedService.unpinFeedPost({
      ...this.actorFromRequest(request),
      feedPostId,
    });
  }

  @Post("admin/feed/:feedPostId/archive")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async archiveFeedPost(@Req() request: FeedRequest, @Param("feedPostId") feedPostId: string) {
    return this.feedService.archiveFeedPost({
      ...this.actorFromRequest(request),
      feedPostId,
    });
  }

  private actorFromRequest(request: FeedRequest) {
    return {
      actorUserId: request.user.userId,
      actorRoles: request.user.roleCodes,
      actorScope: request.user.readScope ?? request.user.scope,
    };
  }

  private toOptionalNumber(value?: string) {
    return value === undefined ? undefined : Number(value);
  }
}
