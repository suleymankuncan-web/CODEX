export type FeedPostType = "announcement" | "challenge";
export type FeedVisibilityScopeType = "company" | "region" | "store";
export type FeedPublishStatus = "draft" | "published" | "archived";

export type FeedScope = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
};

export type FeedPost = {
  feedPostId: string;
  postType: FeedPostType;
  title: string;
  body: string;
  linkLabel: string | null;
  linkUrl: string | null;
  visibilityScopeType: FeedVisibilityScopeType;
  visibilityScopeIds: string[];
  isPinned: boolean;
  publishStatus: FeedPublishStatus;
  publishedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  metricCode: string | null;
  metricLabel: string | null;
  challengeStartsOn: string | null;
  challengeEndsOn: string | null;
  targetRoute: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type FeedActor = {
  actorUserId: string;
  actorRoles: string[];
  actorScope: FeedScope;
};

export type CreateFeedPostInput = FeedActor & {
  postType: FeedPostType;
  title: string;
  body: string;
  linkLabel?: string;
  linkUrl?: string;
  visibilityScopeType: FeedVisibilityScopeType;
  visibilityScopeIds?: string[];
  isPinned?: boolean;
  publishStatus?: FeedPublishStatus;
  startsAt?: string;
  endsAt?: string;
  metricCode?: string;
  metricLabel?: string;
  challengeStartsOn?: string;
  challengeEndsOn?: string;
  targetRoute?: string;
};

export type UpdateFeedPostInput = FeedActor & {
  feedPostId: string;
  title?: string;
  body?: string;
  linkLabel?: string | null;
  linkUrl?: string | null;
  visibilityScopeType?: FeedVisibilityScopeType;
  visibilityScopeIds?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  metricCode?: string | null;
  metricLabel?: string | null;
  challengeStartsOn?: string | null;
  challengeEndsOn?: string | null;
  targetRoute?: string | null;
};

export const feedTargetRoutes = ["/store/rankings", "/store/me"] as const;

export function isInternalFeedRoute(route: string) {
  return route.startsWith("/store/") || route.startsWith("/admin/");
}
