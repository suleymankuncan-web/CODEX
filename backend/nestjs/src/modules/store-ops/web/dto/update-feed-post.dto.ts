import type { FeedVisibilityScopeType } from "../../application/feed.contract";

export class UpdateFeedPostDto {
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
}
