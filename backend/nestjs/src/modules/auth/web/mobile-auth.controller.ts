import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedUser } from "../auth-context.service";
import {
  MobileSessionDto,
  MobileSessionService,
} from "../mobile-session.service";
import { MobileSessionGuard } from "../guards/mobile-session.guard";
import { RegisterMobileSessionDto } from "./dto/register-mobile-session.dto";

type MobileAuthRequest = {
  user: AuthenticatedUser;
  mobileSession?: MobileSessionDto;
};

@Controller("mobile/auth")
export class MobileAuthController {
  constructor(private readonly mobileSessionService: MobileSessionService) {}

  @Post("sessions")
  async registerSession(
    @Req() request: MobileAuthRequest,
    @Body() body: RegisterMobileSessionDto,
  ) {
    return this.mobileSessionService.registerSession(request.user, body);
  }

  @UseGuards(MobileSessionGuard)
  @Get("session")
  async getCurrentSession(@Req() request: MobileAuthRequest) {
    return {
      authenticated: true,
      mobileSession: requireMobileSession(request),
      user: mapAuthenticatedUser(request.user),
      scopeSummary: buildScopeSummary(request.user),
    };
  }

  @UseGuards(MobileSessionGuard)
  @Get("sessions")
  async listSessions(@Req() request: MobileAuthRequest) {
    return this.mobileSessionService.listSessions(request.user);
  }

  @UseGuards(MobileSessionGuard)
  @Post("logout")
  async logout(@Req() request: MobileAuthRequest) {
    return this.mobileSessionService.logoutCurrentSession({
      user: request.user,
      sessionId: requireMobileSession(request).sessionId,
    });
  }

  @UseGuards(MobileSessionGuard)
  @Delete("sessions/:sessionId")
  async revokeSession(
    @Req() request: MobileAuthRequest,
    @Param("sessionId") sessionId: string,
  ) {
    return this.mobileSessionService.revokeOwnSession({
      user: request.user,
      sessionId,
    });
  }
}

function requireMobileSession(request: MobileAuthRequest) {
  if (!request.mobileSession) {
    throw new Error("Mobile session guard did not attach a session");
  }

  return request.mobileSession;
}

function mapAuthenticatedUser(user: AuthenticatedUser) {
  return {
    userId: user.userId,
    employeeId: user.employeeId ?? null,
    roleCodes: user.roleCodes,
    scope: {
      companyIds: user.scope.companyIds,
      regionIds: user.scope.regionIds,
      storeIds: user.scope.storeIds,
    },
    readScope: {
      companyIds: user.readScope.companyIds,
      regionIds: user.readScope.regionIds,
      storeIds: user.readScope.storeIds,
    },
    actionScope: {
      assignedStoreIds: user.actionScope.assignedStoreIds,
    },
    assignedStoreIds: user.assignedStoreIds,
  };
}

function buildScopeSummary(user: AuthenticatedUser) {
  return {
    companyCount: user.scope.companyIds.length,
    regionCount: user.scope.regionIds.length,
    storeCount: user.scope.storeIds.length,
    assignedStoreCount: user.assignedStoreIds.length,
  };
}
