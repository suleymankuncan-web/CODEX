import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AppConfigService } from "../../../shared/app-config.service";
import { BrowserSessionService } from "../browser-session.service";
import { parseCookieHeader } from "../browser-session-cookie";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const BROWSER_SESSION_ENDPOINT = "/api/auth/browser-session";

@Injectable()
export class BrowserSessionCsrfGuard implements CanActivate {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly browserSessionService: BrowserSessionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.appConfigService.browserSessionCookieEnabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      method: string;
      originalUrl?: string;
      path?: string;
      url?: string;
    }>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    if (this.isBrowserSessionEndpoint(request)) {
      return true;
    }

    const authorization = resolveHeader(request.headers.authorization);
    if (authorization?.startsWith("Bearer ")) {
      return true;
    }

    const cookies = parseCookieHeader(request.headers.cookie);
    const cookieValue = cookies[this.appConfigService.browserSessionCookieName];
    if (!cookieValue) {
      return true;
    }

    const csrfToken = resolveHeader(request.headers["x-csrf-token"]);
    if (!this.browserSessionService.verifyCsrfToken(cookieValue, csrfToken)) {
      throw new ForbiddenException("CSRF token is required");
    }

    return true;
  }

  private isBrowserSessionEndpoint(request: {
    originalUrl?: string;
    path?: string;
    url?: string;
  }): boolean {
    const path = request.originalUrl ?? request.path ?? request.url ?? "";
    return path.split("?")[0] === BROWSER_SESSION_ENDPOINT;
  }
}

function resolveHeader(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}
