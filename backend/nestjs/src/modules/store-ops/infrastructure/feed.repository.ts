import { Injectable } from "@nestjs/common";
import { QueryResultRow } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";
import {
  CreateFeedPostInput,
  FeedActor,
  FeedPost,
  FeedPostType,
  FeedPublishStatus,
  FeedVisibilityScopeType,
  UpdateFeedPostInput,
} from "../application/feed.contract";

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
};

type FeedPostRow = {
  feed_post_id: string;
  post_type: FeedPostType;
  title: string;
  body: string;
  link_label: string | null;
  link_url: string | null;
  visibility_scope_type: FeedVisibilityScopeType;
  visibility_scope_ids: string[];
  is_pinned: boolean;
  publish_status: FeedPublishStatus;
  published_at: string | Date | null;
  starts_at: string | Date | null;
  ends_at: string | Date | null;
  metric_code: string | null;
  metric_label: string | null;
  challenge_starts_on: string | Date | null;
  challenge_ends_on: string | Date | null;
  target_route: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type PersistedCreateFeedPostInput = CreateFeedPostInput & {
  visibilityScopeIds: string[];
  isPinned: boolean;
  publishStatus: FeedPublishStatus;
};

type PersistedUpdateFeedPostInput = UpdateFeedPostInput & {
  visibilityScopeType?: FeedVisibilityScopeType;
  visibilityScopeIds?: string[];
};

const feedPostColumns = `
  feed_post_id,
  post_type,
  title,
  body,
  link_label,
  link_url,
  visibility_scope_type,
  visibility_scope_ids,
  is_pinned,
  publish_status,
  published_at,
  starts_at,
  ends_at,
  metric_code,
  metric_label,
  challenge_starts_on,
  challenge_ends_on,
  target_route,
  created_by_user_id,
  updated_by_user_id,
  created_at,
  updated_at
`;

@Injectable()
export class FeedRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private hasVisibleScope(actorScope: FeedActor["actorScope"]) {
    return (
      actorScope.companyIds.length > 0 ||
      actorScope.regionIds.length > 0 ||
      actorScope.storeIds.length > 0
    );
  }

  async listVisibleFeedPosts(input: {
    actorScope: FeedActor["actorScope"];
    limit: number;
    offset: number;
  }) {
    if (!this.hasVisibleScope(input.actorScope)) {
      return [];
    }

    const result = await this.databaseService.query<FeedPostRow>(
      `
        WITH actor_store_regions AS (
          SELECT DISTINCT region_id
          FROM ops.store
          WHERE store_id = ANY($3::uuid[])
        )
        SELECT
          ${feedPostColumns
            .split("\n")
            .map((column) => (column.trim() ? `fp.${column.trim()}` : ""))
            .filter(Boolean)
            .join("\n          ")}
        FROM ops.feed_post fp
        WHERE fp.publish_status = 'published'
          AND (fp.starts_at IS NULL OR fp.starts_at <= NOW())
          AND (fp.ends_at IS NULL OR fp.ends_at >= NOW())
          AND (
            ($1::boolean = TRUE AND fp.visibility_scope_type = 'company')
            OR (
              fp.visibility_scope_type = 'region'
              AND (
                fp.visibility_scope_ids && $2::uuid[]
                OR fp.visibility_scope_ids && ARRAY(SELECT region_id FROM actor_store_regions)
              )
            )
            OR (
              fp.visibility_scope_type = 'store'
              AND fp.visibility_scope_ids && $3::uuid[]
            )
          )
        ORDER BY fp.is_pinned DESC, fp.published_at DESC NULLS LAST, fp.updated_at DESC
        LIMIT $4::int
        OFFSET $5::int
      `,
      [
        this.hasVisibleScope(input.actorScope),
        input.actorScope.regionIds,
        input.actorScope.storeIds,
        input.limit,
        input.offset,
      ],
    );

    return result.rows.map((row) => this.mapFeedPost(row));
  }

  async listManageableFeedPosts(input: {
    actorRoles: string[];
    actorScope: FeedActor["actorScope"];
    limit: number;
    offset: number;
  }) {
    if (input.actorRoles.includes("SUPER_ADMIN") || input.actorRoles.includes("HR_ADMIN")) {
      const result = await this.databaseService.query<FeedPostRow>(
        `
          SELECT
            ${feedPostColumns}
          FROM ops.feed_post
          ORDER BY is_pinned DESC, updated_at DESC
          LIMIT $1::int
          OFFSET $2::int
        `,
        [input.limit, input.offset],
      );

      return result.rows.map((row) => this.mapFeedPost(row));
    }

    if (input.actorRoles.includes("REGION_MANAGER")) {
      const result = await this.databaseService.query<FeedPostRow>(
        `
          SELECT
            ${feedPostColumns}
          FROM ops.feed_post
          WHERE visibility_scope_type = 'region'
            AND visibility_scope_ids && $1::uuid[]
          ORDER BY is_pinned DESC, updated_at DESC
          LIMIT $2::int
          OFFSET $3::int
        `,
        [input.actorScope.regionIds, input.limit, input.offset],
      );

      return result.rows.map((row) => this.mapFeedPost(row));
    }

    return [];
  }

  async getFeedPost(feedPostId: string) {
    const result = await this.databaseService.query<FeedPostRow>(
      `
        SELECT
          ${feedPostColumns}
        FROM ops.feed_post
        WHERE feed_post_id = $1::uuid
      `,
      [feedPostId],
    );

    return result.rows[0] ? this.mapFeedPost(result.rows[0]) : null;
  }

  async createFeedPost(input: PersistedCreateFeedPostInput) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<FeedPostRow>(
        `
          INSERT INTO ops.feed_post (
            post_type,
            title,
            body,
            link_label,
            link_url,
            visibility_scope_type,
            visibility_scope_ids,
            is_pinned,
            publish_status,
            published_at,
            starts_at,
            ends_at,
            metric_code,
            metric_label,
            challenge_starts_on,
            challenge_ends_on,
            target_route,
            created_by_user_id,
            updated_by_user_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7::uuid[],
            $8::boolean,
            $9,
            CASE WHEN $9 = 'published' THEN NOW() ELSE NULL END,
            $10::timestamptz,
            $11::timestamptz,
            $12,
            $13,
            $14::date,
            $15::date,
            $16,
            $17::uuid,
            $17::uuid
          )
          RETURNING
            ${feedPostColumns}
        `,
        [
          input.postType,
          input.title,
          input.body,
          input.linkLabel ?? null,
          input.linkUrl ?? null,
          input.visibilityScopeType,
          input.visibilityScopeIds,
          input.isPinned,
          input.publishStatus,
          input.startsAt ?? null,
          input.endsAt ?? null,
          input.metricCode ?? null,
          input.metricLabel ?? null,
          input.challengeStartsOn ?? null,
          input.challengeEndsOn ?? null,
          input.targetRoute ?? null,
          input.actorUserId,
        ],
      );
      const feedPost = this.mapFeedPost(result.rows[0]);

      await this.writeAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "feed_post.created",
        feedPost,
      });

      return feedPost;
    });
  }

  async updateFeedPost(input: PersistedUpdateFeedPostInput) {
    return this.databaseService.withTransaction(async (client) => {
      const existing = await this.getFeedPostForUpdate(client, input.feedPostId);
      const next = {
        title: input.title === undefined ? existing.title : input.title,
        body: input.body === undefined ? existing.body : input.body,
        linkLabel: input.linkLabel === undefined ? existing.linkLabel : input.linkLabel,
        linkUrl: input.linkUrl === undefined ? existing.linkUrl : input.linkUrl,
        visibilityScopeType:
          input.visibilityScopeType === undefined
            ? existing.visibilityScopeType
            : input.visibilityScopeType,
        visibilityScopeIds:
          input.visibilityScopeIds === undefined
            ? existing.visibilityScopeIds
            : input.visibilityScopeIds,
        startsAt: input.startsAt === undefined ? existing.startsAt : input.startsAt,
        endsAt: input.endsAt === undefined ? existing.endsAt : input.endsAt,
        metricCode: input.metricCode === undefined ? existing.metricCode : input.metricCode,
        metricLabel: input.metricLabel === undefined ? existing.metricLabel : input.metricLabel,
        challengeStartsOn:
          input.challengeStartsOn === undefined
            ? existing.challengeStartsOn
            : input.challengeStartsOn,
        challengeEndsOn:
          input.challengeEndsOn === undefined ? existing.challengeEndsOn : input.challengeEndsOn,
        targetRoute: input.targetRoute === undefined ? existing.targetRoute : input.targetRoute,
      };

      const result = await client.query<FeedPostRow>(
        `
          UPDATE ops.feed_post
          SET
            title = $2,
            body = $3,
            link_label = $4,
            link_url = $5,
            visibility_scope_type = $6,
            visibility_scope_ids = $7::uuid[],
            starts_at = $8::timestamptz,
            ends_at = $9::timestamptz,
            metric_code = $10,
            metric_label = $11,
            challenge_starts_on = $12::date,
            challenge_ends_on = $13::date,
            target_route = $14,
            updated_by_user_id = $15::uuid,
            updated_at = NOW()
          WHERE feed_post_id = $1::uuid
          RETURNING
            ${feedPostColumns}
        `,
        [
          input.feedPostId,
          next.title,
          next.body,
          next.linkLabel,
          next.linkUrl,
          next.visibilityScopeType,
          next.visibilityScopeIds,
          next.startsAt,
          next.endsAt,
          next.metricCode,
          next.metricLabel,
          next.challengeStartsOn,
          next.challengeEndsOn,
          next.targetRoute,
          input.actorUserId,
        ],
      );
      const feedPost = this.mapFeedPost(result.rows[0]);

      await this.writeAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "feed_post.updated",
        feedPost,
      });

      if (
        existing.visibilityScopeType !== feedPost.visibilityScopeType ||
        !this.sameScopeIds(existing.visibilityScopeIds, feedPost.visibilityScopeIds)
      ) {
        await this.writeAudit(client, {
          actorUserId: input.actorUserId,
          eventType: "feed_post.scope_changed",
          feedPost,
        });
      }

      return feedPost;
    });
  }

  async publishFeedPost(input: FeedActor & { feedPostId: string }) {
    return this.updateLifecycle(input, {
      sqlSet: "publish_status = 'published', published_at = COALESCE(published_at, NOW())",
      eventType: "feed_post.published",
    });
  }

  async pinFeedPost(input: FeedActor & { feedPostId: string }) {
    return this.updateLifecycle(input, {
      sqlSet: "is_pinned = TRUE",
      eventType: "feed_post.pinned",
    });
  }

  async unpinFeedPost(input: FeedActor & { feedPostId: string }) {
    return this.updateLifecycle(input, {
      sqlSet: "is_pinned = FALSE",
      eventType: "feed_post.unpinned",
    });
  }

  async archiveFeedPost(input: FeedActor & { feedPostId: string }) {
    return this.updateLifecycle(input, {
      sqlSet: "publish_status = 'archived'",
      eventType: "feed_post.archived",
    });
  }

  private async updateLifecycle(
    input: FeedActor & { feedPostId: string },
    lifecycle: {
      sqlSet: string;
      eventType: string;
    },
  ) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<FeedPostRow>(
        `
          UPDATE ops.feed_post
          SET
            ${lifecycle.sqlSet},
            updated_by_user_id = $2::uuid,
            updated_at = NOW()
          WHERE feed_post_id = $1::uuid
          RETURNING
            ${feedPostColumns}
        `,
        [input.feedPostId, input.actorUserId],
      );
      const feedPost = this.mapFeedPost(result.rows[0]);

      await this.writeAudit(client, {
        actorUserId: input.actorUserId,
        eventType: lifecycle.eventType,
        feedPost,
      });

      return feedPost;
    });
  }

  private async getFeedPostForUpdate(client: Queryable, feedPostId: string) {
    const result = await client.query<FeedPostRow>(
      `
        SELECT
          ${feedPostColumns}
        FROM ops.feed_post
        WHERE feed_post_id = $1::uuid
        FOR UPDATE
      `,
      [feedPostId],
    );

    if (!result.rows[0]) {
      throw new Error("Feed post not found");
    }

    return this.mapFeedPost(result.rows[0]);
  }

  private async writeAudit(
    client: Queryable,
    input: {
      actorUserId: string;
      eventType: string;
      feedPost: FeedPost;
    },
  ) {
    const scope = this.auditScope(input.feedPost);

    await client.query(
      `
        INSERT INTO audit.event_log (
          actor_user_id,
          event_type,
          entity_name,
          entity_id,
          scope_type,
          company_id,
          region_id,
          store_id,
          metadata_json
        )
        VALUES (
          NULL,
          $1,
          'ops.feed_post',
          $2::uuid,
          $3,
          NULL,
          $4::uuid,
          $5::uuid,
          $6::jsonb
        )
      `,
      [
        input.eventType,
        input.feedPost.feedPostId,
        input.feedPost.visibilityScopeType,
        scope.regionId,
        scope.storeId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          actorUserId: input.actorUserId,
          visibilityScopeType: input.feedPost.visibilityScopeType,
          visibilityScopeIds: input.feedPost.visibilityScopeIds,
          postType: input.feedPost.postType,
        }),
      ],
    );
  }

  private auditScope(feedPost: FeedPost) {
    if (feedPost.visibilityScopeType === "region" && feedPost.visibilityScopeIds.length === 1) {
      return {
        regionId: feedPost.visibilityScopeIds[0],
        storeId: null,
      };
    }

    if (feedPost.visibilityScopeType === "store" && feedPost.visibilityScopeIds.length === 1) {
      return {
        regionId: null,
        storeId: feedPost.visibilityScopeIds[0],
      };
    }

    return {
      regionId: null,
      storeId: null,
    };
  }

  private mapFeedPost(row: FeedPostRow): FeedPost {
    return {
      feedPostId: row.feed_post_id,
      postType: row.post_type,
      title: row.title,
      body: row.body,
      linkLabel: row.link_label,
      linkUrl: row.link_url,
      visibilityScopeType: row.visibility_scope_type,
      visibilityScopeIds: row.visibility_scope_ids ?? [],
      isPinned: row.is_pinned,
      publishStatus: row.publish_status,
      publishedAt: this.toIsoString(row.published_at),
      startsAt: this.toIsoString(row.starts_at),
      endsAt: this.toIsoString(row.ends_at),
      metricCode: row.metric_code,
      metricLabel: row.metric_label,
      challengeStartsOn: this.toDateOnly(row.challenge_starts_on),
      challengeEndsOn: this.toDateOnly(row.challenge_ends_on),
      targetRoute: row.target_route,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      createdAt: this.toIsoString(row.created_at) ?? String(row.created_at),
      updatedAt: this.toIsoString(row.updated_at) ?? String(row.updated_at),
    };
  }

  private toIsoString(value: string | Date | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }

  private toDateOnly(value: string | Date | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
  }

  private sameScopeIds(left: string[], right: string[]) {
    const normalizedLeft = [...left].sort();
    const normalizedRight = [...right].sort();
    return (
      normalizedLeft.length === normalizedRight.length &&
      normalizedLeft.every((value, index) => value === normalizedRight[index])
    );
  }
}
