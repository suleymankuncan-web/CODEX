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
    actionScope: { assignedStoreIds: string[] };
    employeeId?: string;
    readScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    roleCodes: string[];
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

@Injectable()
export class BrowserSessionService {
  constructor(private readonly appConfigService: AppConfigService) {}

  issueSession(user: AuthenticatedUser, now = Date.now()): BrowserSessionIssueResult {
    const csrfNonce = randomBytes(32).toString("base64url");
    const issuedAt = Math.floor(now / 1000);
    const expiresAt = issuedAt + this.appConfigService.browserSessionTtlSeconds;
    const envelope: BrowserSessionEnvelope = {
      alg: SIGNING_ALGORITHM,
      csrfHash: this.hashCsrfNonce(csrfNonce),
      exp: expiresAt,
      iat: issuedAt,
      sid: randomBytes(16).toString("base64url"),
      user: {
        actionScope: {
          assignedStoreIds: user.actionScope.assignedStoreIds,
        },
        employeeId: user.employeeId,
        readScope: user.readScope,
        roleCodes: user.roleCodes,
        userId: user.userId,
      },
      v: SESSION_VERSION,
    };

    return {
      cookieValue: this.signEnvelope(envelope),
      csrfNonce,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      sessionId: envelope.sid,
    };
  }

  verifySession(cookieValue: string, now = Date.now()): {
    envelope: BrowserSessionEnvelope;
    user: AuthenticatedUser;
  } {
    const envelope = this.verifySignedEnvelope(cookieValue);
    const currentTimeSeconds = Math.floor(now / 1000);

    if (envelope.exp <= currentTimeSeconds) {
      throw new UnauthorizedException("Invalid browser session");
    }

    return {
      envelope,
      user: {
        userId: envelope.user.userId,
        employeeId: envelope.user.employeeId,
        roleCodes: envelope.user.roleCodes,
        scope: envelope.user.readScope,
        readScope: envelope.user.readScope,
        actionScope: envelope.user.actionScope,
        assignedStoreIds: envelope.user.actionScope.assignedStoreIds,
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

  private signEnvelope(envelope: BrowserSessionEnvelope): string {
    const payload = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
    return `${payload}.${this.signPayload(payload, this.appConfigService.browserSessionSecret)}`;
  }

  private verifySignedEnvelope(cookieValue: string): BrowserSessionEnvelope {
    const [payload, signature, extra] = cookieValue.split(".");
    if (!payload || !signature || extra !== undefined) {
      throw new UnauthorizedException("Invalid browser session");
    }

    if (
      !this.signatureMatches(payload, signature, this.appConfigService.browserSessionSecret) &&
      !this.signatureMatches(payload, signature, this.appConfigService.browserSessionPreviousSecret)
    ) {
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

    return parsed as BrowserSessionEnvelope;
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
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
