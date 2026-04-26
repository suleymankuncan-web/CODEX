import type {
  FeedPostType,
  FeedPublishStatus,
  FeedVisibilityScopeType,
} from "../../application/feed.contract";

export class CreateFeedPostDto {
  postType!: FeedPostType;
  title!: string;
  body!: string;
  linkLabel?: string;
  linkUrl?: string;
  visibilityScopeType!: FeedVisibilityScopeType;
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
}
