import { createHash } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthenticatedUser } from "./auth-context.service";
import {
  MobileDeviceSessionRow,
  MobileSessionPlatform,
  MobileSessionRepository,
} from "./mobile-session.repository";

export type RegisterMobileSessionInput = {
  deviceId: string;
  platform: MobileSessionPlatform;
  deviceName?: string | null;
  appVersion?: string | null;
  osVersion?: string | null;
};

export type MobileSessionDto = {
  sessionId: string;
  userId: string;
  platform: MobileSessionPlatform;
  deviceName: string | null;
  appVersion: string | null;
  osVersion: string | null;
  status: "active" | "revoked" | "expired";
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revocationReason: string | null;
};

@Injectable()
export class MobileSessionService {
  constructor(private readonly mobileSessionRepository: MobileSessionRepository) {}

  async registerSession(user: AuthenticatedUser, input: RegisterMobileSessionInput) {
    const deviceIdHash = hashDeviceId(input.deviceId);
    const existing = await this.mobileSessionRepository.findActiveByUserAndDeviceHash({
      userId: user.userId,
      deviceIdHash,
    });

    const session = existing
      ? await this.mobileSessionRepository.touchSession({
        sessionId: existing.mobile_device_session_id,
        userId: user.userId,
      })
      : await this.mobileSessionRepository.createSession({
        userId: user.userId,
        providerSubject: user.userId,
        deviceIdHash,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
        appVersion: input.appVersion ?? null,
        osVersion: input.osVersion ?? null,
      });

    if (!session) {
      throw new UnauthorizedException("Mobile session could not be registered");
    }

    return {
      mobileSession: mapMobileSession(session),
    };
  }

  async assertActiveSession(input: { userId: string; sessionId: string }) {
    if (!isUuid(input.sessionId)) {
      throw new UnauthorizedException("Mobile session is invalid");
    }

    const session = await this.mobileSessionRepository.getActiveSessionForUser(input);
    if (!session) {
      throw new UnauthorizedException("Mobile session is not active");
    }

    return mapMobileSession(session);
  }

  async listSessions(user: AuthenticatedUser) {
    const rows = await this.mobileSessionRepository.listSessionsForUser({
      userId: user.userId,
    });

    return {
      items: rows.map((item) => mapMobileSession(item)),
      meta: {
        count: rows.length,
        total: rows.length,
        limit: 25,
        offset: 0,
      },
    };
  }

  async logoutCurrentSession(input: { user: AuthenticatedUser; sessionId: string }) {
    return this.revokeOwnSession({
      user: input.user,
      sessionId: input.sessionId,
      reason: "user_logout",
    });
  }

  async revokeOwnSession(input: {
    user: AuthenticatedUser;
    sessionId: string;
    reason?: string;
  }) {
    if (!isUuid(input.sessionId)) {
      throw new UnauthorizedException("Mobile session is invalid");
    }

    const session = await this.mobileSessionRepository.revokeSession({
      sessionId: input.sessionId,
      userId: input.user.userId,
      revokedByUserId: input.user.userId,
      reason: input.reason ?? "user_revoke",
    });

    if (!session) {
      throw new UnauthorizedException("Mobile session is not active");
    }

    return {
      mobileSession: mapMobileSession(session),
    };
  }
}

export function mapMobileSession(row: MobileDeviceSessionRow): MobileSessionDto {
  return {
    sessionId: row.mobile_device_session_id,
    userId: row.user_id,
    platform: row.platform,
    deviceName: row.device_name,
    appVersion: row.app_version,
    osVersion: row.os_version,
    status: row.status,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedByUserId: row.revoked_by_user_id,
    revocationReason: row.revocation_reason,
  };
}

function hashDeviceId(deviceId: string) {
  return createHash("sha256").update(deviceId).digest("hex");
}

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    input,
  );
}
