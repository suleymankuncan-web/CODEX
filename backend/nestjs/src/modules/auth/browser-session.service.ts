import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AppConfigService } from "../../shared/app-config.service";
import type { AuthenticatedUser } from "./auth-context.service";

const SESSION_VERSION = 1;
const SIGNING_ALGORITHM = "HS256";

export interface BrowserSessionEnvelope {
  alg: typeof SIGNING_ALGORITHM;
  csrfHash: string;
  exp: number;
  iat: number;
  sid: string;
  user: {
    actionScope: { assignedStoreIds: string[]; assignedStoreTypes?: string[] };
    displayName?: string;
    email?: string;
    employeeId?: string;
    readScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    roleCodes: string[];
    username?: string;
    userId: string;
  };
  v: typeof SESSION_VERSION;
}

export interface BrowserSessionIssueResult {
  cookieValue: string;
  csrfNonce: string;
  expiresAt: string;
  sessionId: string;
}

export interface BrowserSessionCsrfRecoveryResult {
  csrfNonce: string;
  expiresAt: string;
  sessionId: string;
}

@Injectable()
export class BrowserSessionService {
  constructor(private readonly appConfigService: AppConfigService) {}

  issueSession(user: AuthenticatedUser, now = Date.now()): BrowserSessionIssueResult {
    const signingSecret = this.requireSigningSecret();
    const issuedAt = Math.floor(now / 1000);
    const expiresAt = issuedAt + this.appConfigService.browserSessionTtlSeconds;
    const envelope: BrowserSessionEnvelope = {
      alg: SIGNING_ALGORITHM,
      csrfHash: "",
      exp: expiresAt,
      iat: issuedAt,
      sid: randomBytes(16).toString("base64url"),
      user: {
        actionScope: {
          assignedStoreIds: user.actionScope.assignedStoreIds,
          assignedStoreTypes: user.actionScope.assignedStoreTypes ?? [],
        },
        displayName: user.displayName,
        email: user.email,
        employeeId: user.employeeId,
        readScope: user.readScope,
        roleCodes: user.roleCodes,
        username: user.username,
        userId: user.userId,
      },
      v: SESSION_VERSION,
    };
    const csrfNonce = this.deriveCsrfRecoveryNonce(envelope, signingSecret);
    envelope.csrfHash = this.hashCsrfNonce(csrfNonce);

    return {
      cookieValue: this.signEnvelope(envelope, signingSecret),
      csrfNonce,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      sessionId: envelope.sid,
    };
  }

  recoverCsrfNonce(cookieValue: string, now = Date.now()): BrowserSessionCsrfRecoveryResult {
    const { envelope, signingSecret } = this.verifySignedEnvelope(cookieValue);
    if (envelope.exp <= Math.floor(now / 1000)) {
      throw new UnauthorizedException("Invalid browser session");
    }
    const csrfNonce = this.deriveCsrfRecoveryNonce(envelope, signingSecret);
    if (!timingSafeStringEqual(envelope.csrfHash, this.hashCsrfNonce(csrfNonce))) {
      throw new UnauthorizedException("Invalid browser session");
    }
    return {
      csrfNonce,
      expiresAt: new Date(envelope.exp * 1000).toISOString(),
      sessionId: envelope.sid,
    };
  }

  verifySession(cookieValue: string, now = Date.now()): {
    envelope: BrowserSessionEnvelope;
    user: AuthenticatedUser;
  } {
    const { envelope } = this.verifySignedEnvelope(cookieValue);
    const currentTimeSeconds = Math.floor(now / 1000);

    if (envelope.exp <= currentTimeSeconds) {
      throw new UnauthorizedException("Invalid browser session");
    }

    const actionScope = {
      assignedStoreIds: envelope.user.actionScope.assignedStoreIds,
      assignedStoreTypes: envelope.user.actionScope.assignedStoreTypes ?? [],
    };

    return {
      envelope,
      user: {
        userId: envelope.user.userId,
        employeeId: envelope.user.employeeId,
        displayName: envelope.user.displayName,
        username: envelope.user.username,
        email: envelope.user.email,
        roleCodes: envelope.user.roleCodes,
        scope: envelope.user.readScope,
        readScope: envelope.user.readScope,
        actionScope,
        assignedStoreIds: actionScope.assignedStoreIds,
        assignedStoreTypes: actionScope.assignedStoreTypes,
      },
    };
  }

  verifyCsrfToken(cookieValue: string, csrfToken: string | undefined): boolean {
    if (!csrfToken) {
      return false;
    }

    try {
      const { envelope } = this.verifySession(cookieValue);
      return timingSafeStringEqual(envelope.csrfHash, this.hashCsrfNonce(csrfToken));
    } catch {
      return false;
    }
  }

  private signEnvelope(envelope: BrowserSessionEnvelope, secret = this.appConfigService.browserSessionSecret): string {
    const payload = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
    return `${payload}.${this.signPayload(payload, secret)}`;
  }

  private verifySignedEnvelope(cookieValue: string): {
    envelope: BrowserSessionEnvelope;
    signingSecret: string;
  } {
    const [payload, signature, extra] = cookieValue.split(".");
    if (!payload || !signature || extra !== undefined) {
      throw new UnauthorizedException("Invalid browser session");
    }

    const currentSecret = this.appConfigService.browserSessionSecret;
    const previousSecret = this.appConfigService.browserSessionPreviousSecret;
    let signingSecret: string | undefined;
    if (this.signatureMatches(payload, signature, currentSecret)) {
      signingSecret = currentSecret;
    } else if (this.signatureMatches(payload, signature, previousSecret)) {
      signingSecret = previousSecret;
    }

    if (!signingSecret) {
      throw new UnauthorizedException("Invalid browser session");
    }

    let parsed: Partial<BrowserSessionEnvelope>;
    try {
      parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<
        BrowserSessionEnvelope
      >;
    } catch {
      throw new UnauthorizedException("Invalid browser session");
    }

    if (
      parsed.v !== SESSION_VERSION ||
      parsed.alg !== SIGNING_ALGORITHM ||
      typeof parsed.exp !== "number" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.sid !== "string" ||
      typeof parsed.csrfHash !== "string" ||
      typeof parsed.user?.userId !== "string"
    ) {
      throw new UnauthorizedException("Invalid browser session");
    }

    return { envelope: parsed as BrowserSessionEnvelope, signingSecret };
  }

  private signatureMatches(
    payload: string,
    signature: string,
    secret: string | undefined,
  ): boolean {
    if (!secret) {
      return false;
    }

    return timingSafeStringEqual(signature, this.signPayload(payload, secret));
  }

  private signPayload(payload: string, secret: string | undefined): string {
    if (!secret) {
      throw new UnauthorizedException("Invalid browser session");
    }

    return createHmac("sha256", secret).update(payload).digest("base64url");
  }

  private hashCsrfNonce(csrfNonce: string): string {
    return createHash("sha256").update(csrfNonce).digest("base64url");
  }

  private deriveCsrfRecoveryNonce(
    envelope: BrowserSessionEnvelope,
    signingSecret: string,
  ): string {
    if (!signingSecret) {
      throw new UnauthorizedException("Invalid browser session");
    }

    return createHmac("sha256", signingSecret)
      .update("hr-axis/browser-session/csrf-recovery/v1\0", "utf8")
      .update(JSON.stringify({ exp: envelope.exp, iat: envelope.iat, sid: envelope.sid }), "utf8")
      .digest("base64url");
  }

  private requireSigningSecret(): string {
    const secret = this.appConfigService.browserSessionSecret;
    if (!secret) {
      throw new UnauthorizedException("Invalid browser session");
    }
    return secret;
  }
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
