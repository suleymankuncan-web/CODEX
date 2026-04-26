import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { buildCommandResponse, buildListResponse } from "../../../shared/http/response-builders";
import {
  CreateFeedPostInput,
  FeedActor,
  FeedPost,
  FeedPublishStatus,
  FeedVisibilityScopeType,
  isInternalFeedRoute,
  UpdateFeedPostInput,
} from "./feed.contract";

type FeedRepositoryCreateInput = CreateFeedPostInput & {
  visibilityScopeIds: string[];
  isPinned: boolean;
  publishStatus: FeedPublishStatus;
};

type FeedRepositoryUpdateInput = UpdateFeedPostInput & {
  visibilityScopeType?: FeedVisibilityScopeType;
  visibilityScopeIds?: string[];
};

type FeedRepositoryPort = {
  listVisibleFeedPosts(input: {
    actorScope: FeedActor["actorScope"];
    limit: number;
    offset: number;
  }): Promise<FeedPost[]>;
  listManageableFeedPosts(input: {
    actorRoles: string[];
    actorScope: FeedActor["actorScope"];
    limit: number;
    offset: number;
  }): Promise<FeedPost[]>;
  getFeedPost(feedPostId: string): Promise<FeedPost | null>;
  createFeedPost(input: FeedRepositoryCreateInput): Promise<FeedPost>;
  updateFeedPost(input: FeedRepositoryUpdateInput): Promise<FeedPost>;
  publishFeedPost(input: FeedActor & { feedPostId: string }): Promise<FeedPost>;
  pinFeedPost(input: FeedActor & { feedPostId: string }): Promise<FeedPost>;
  unpinFeedPost(input: FeedActor & { feedPostId: string }): Promise<FeedPost>;
  archiveFeedPost(input: FeedActor & { feedPostId: string }): Promise<FeedPost>;
};

@Injectable()
export class FeedService {
  constructor(private readonly feedRepository: FeedRepositoryPort) {}

  async listVisibleFeedPosts(input: FeedActor & { limit?: number; offset?: number }) {
    const limit = this.normalizeLimit(input.limit);
    const offset = this.normalizeOffset(input.offset);
    const items = await this.feedRepository.listVisibleFeedPosts({
      actorScope: input.actorScope,
      limit,
      offset,
    });

    return buildListResponse(items, {
      total: items.length,
      limit,
      offset,
    });
  }

  async listManageableFeedPosts(input: FeedActor & { limit?: number; offset?: number }) {
    const limit = this.normalizeLimit(input.limit);
    const offset = this.normalizeOffset(input.offset);
    const items = await this.feedRepository.listManageableFeedPosts({
      actorRoles: input.actorRoles,
      actorScope: input.actorScope,
      limit,
      offset,
    });

    return buildListResponse(items, {
      total: items.length,
      limit,
      offset,
    });
  }

  async createFeedPost(input: CreateFeedPostInput) {
    const visibilityScopeIds = this.normalizeScopeIds({
      actorRoles: input.actorRoles,
      actorScope: input.actorScope,
      visibilityScopeType: input.visibilityScopeType,
      visibilityScopeIds: input.visibilityScopeIds ?? [],
    });
    const title = this.requireText(input.title, "title");
    const body = this.requireText(input.body, "body");

    this.assertWritableScope({
      actorRoles: input.actorRoles,
      actorScope: input.actorScope,
      visibilityScopeType: input.visibilityScopeType,
      visibilityScopeIds,
    });
    this.assertInternalRoute(input.linkUrl, "linkUrl");
    this.assertChallengeFields({
      postType: input.postType,
      metricCode: input.metricCode,
      metricLabel: input.metricLabel,
      challengeStartsOn: input.challengeStartsOn,
      challengeEndsOn: input.challengeEndsOn,
      targetRoute: input.targetRoute,
    });

    const feedPost = await this.feedRepository.createFeedPost({
      ...input,
      title,
      body,
      visibilityScopeIds,
      isPinned: input.isPinned ?? false,
      publishStatus: input.publishStatus ?? "draft",
    });

    return buildCommandResponse({
      status: "created",
      message: "Feed post created",
      data: {
        feedPost,
      },
    });
  }

  async updateFeedPost(input: UpdateFeedPostInput) {
    const existing = await this.requireFeedPost(input.feedPostId);

    if (existing.publishStatus === "archived") {
      throw new BadRequestException("Archived feed posts cannot be edited");
    }

    const visibilityScopeType = input.visibilityScopeType ?? existing.visibilityScopeType;
    const visibilityScopeIds =
      input.visibilityScopeIds === undefined
        ? existing.visibilityScopeIds
        : this.normalizeScopeIds({
            actorRoles: input.actorRoles,
            actorScope: input.actorScope,
            visibilityScopeType,
            visibilityScopeIds: input.visibilityScopeIds,
          });
    const title = input.title === undefined ? undefined : this.requireText(input.title, "title");
    const body = input.body === undefined ? undefined : this.requireText(input.body, "body");

    this.assertWritableScope({
      actorRoles: input.actorRoles,
      actorScope: input.actorScope,
      visibilityScopeType,
      visibilityScopeIds,
    });
    this.assertInternalRoute(input.linkUrl ?? undefined, "linkUrl");
    this.assertChallengeFields({
      postType: existing.postType,
      metricCode: input.metricCode ?? existing.metricCode ?? undefined,
      metricLabel: input.metricLabel ?? existing.metricLabel ?? undefined,
      challengeStartsOn: input.challengeStartsOn ?? existing.challengeStartsOn ?? undefined,
      challengeEndsOn: input.challengeEndsOn ?? existing.challengeEndsOn ?? undefined,
      targetRoute: input.targetRoute ?? existing.targetRoute ?? undefined,
    });

    const feedPost = await this.feedRepository.updateFeedPost({
      ...input,
      title,
      body,
      visibilityScopeType,
      visibilityScopeIds,
    });

    return buildCommandResponse({
      status: "updated",
      message: "Feed post updated",
      data: {
        feedPost,
      },
    });
  }

  async publishFeedPost(input: FeedActor & { feedPostId: string }) {
    await this.assertCanMutateExistingPost(input);
    const feedPost = await this.feedRepository.publishFeedPost(input);

    return buildCommandResponse({
      status: "published",
      message: "Feed post published",
      data: { feedPost },
    });
  }

  async pinFeedPost(input: FeedActor & { feedPostId: string }) {
    await this.assertCanMutateExistingPost(input);
    const feedPost = await this.feedRepository.pinFeedPost(input);

    return buildCommandResponse({
      status: "pinned",
      message: "Feed post pinned",
      data: { feedPost },
    });
  }

  async unpinFeedPost(input: FeedActor & { feedPostId: string }) {
    await this.assertCanMutateExistingPost(input);
    const feedPost = await this.feedRepository.unpinFeedPost(input);

    return buildCommandResponse({
      status: "unpinned",
      message: "Feed post unpinned",
      data: { feedPost },
    });
  }

  async archiveFeedPost(input: FeedActor & { feedPostId: string }) {
    await this.assertCanMutateExistingPost(input);
    const feedPost = await this.feedRepository.archiveFeedPost(input);

    return buildCommandResponse({
      status: "archived",
      message: "Feed post archived",
      data: { feedPost },
    });
  }

  private async assertCanMutateExistingPost(input: FeedActor & { feedPostId: string }) {
    const existing = await this.requireFeedPost(input.feedPostId);

    if (existing.publishStatus === "archived") {
      throw new BadRequestException("Archived feed posts cannot be changed");
    }

    this.assertWritableScope({
      actorRoles: input.actorRoles,
      actorScope: input.actorScope,
      visibilityScopeType: existing.visibilityScopeType,
      visibilityScopeIds: existing.visibilityScopeIds,
    });
  }

  private async requireFeedPost(feedPostId: string) {
    const feedPost = await this.feedRepository.getFeedPost(feedPostId);

    if (!feedPost) {
      throw new NotFoundException("Feed post not found");
    }

    return feedPost;
  }

  private assertWritableScope(input: {
    actorRoles: string[];
    actorScope: FeedActor["actorScope"];
    visibilityScopeType: FeedVisibilityScopeType;
    visibilityScopeIds: string[];
  }) {
    if (input.actorRoles.includes("SUPER_ADMIN") || input.actorRoles.includes("HR_ADMIN")) {
      return;
    }

    if (!input.actorRoles.includes("REGION_MANAGER")) {
      throw new ForbiddenException("Missing feed writer role");
    }

    if (input.visibilityScopeType !== "region") {
      throw new ForbiddenException("Region managers can publish only to their own region");
    }

    if (input.visibilityScopeIds.length !== 1) {
      throw new ForbiddenException("Region manager feed posts must target one region");
    }

    if (!input.actorScope.regionIds.includes(input.visibilityScopeIds[0])) {
      throw new ForbiddenException("Region manager cannot publish outside their region");
    }
  }

  private normalizeScopeIds(input: {
    actorRoles: string[];
    actorScope: FeedActor["actorScope"];
    visibilityScopeType: FeedVisibilityScopeType;
    visibilityScopeIds: string[];
  }) {
    if (input.visibilityScopeType === "company") {
      return [];
    }

    const uniqueScopeIds = [...new Set(input.visibilityScopeIds.filter(Boolean))];

    if (uniqueScopeIds.length === 0) {
      throw new BadRequestException(`${input.visibilityScopeType} feed posts require a scope id`);
    }

    return uniqueScopeIds;
  }

  private assertChallengeFields(input: {
    postType: string;
    metricCode?: string;
    metricLabel?: string;
    challengeStartsOn?: string;
    challengeEndsOn?: string;
    targetRoute?: string;
  }) {
    if (input.postType !== "challenge") {
      return;
    }

    if (
      !input.metricCode ||
      !input.metricLabel ||
      !input.challengeStartsOn ||
      !input.challengeEndsOn ||
      !input.targetRoute
    ) {
      throw new BadRequestException("Challenge posts require metric, date range, and target route");
    }

    this.assertInternalRoute(input.targetRoute, "targetRoute");
  }

  private assertInternalRoute(route: string | undefined, fieldName: string) {
    if (!route) {
      return;
    }

    if (!isInternalFeedRoute(route)) {
      throw new BadRequestException(`${fieldName} must be an internal app route`);
    }
  }

  private requireText(value: string, fieldName: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private normalizeLimit(limit?: number) {
    if (!limit || Number.isNaN(limit)) {
      return 50;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), 100);
  }

  private normalizeOffset(offset?: number) {
    if (!offset || Number.isNaN(offset)) {
      return 0;
    }

    return Math.max(Math.trunc(offset), 0);
  }
}
