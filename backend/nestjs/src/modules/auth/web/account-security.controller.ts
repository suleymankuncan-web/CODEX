import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { IsIn, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { AccountSecurityService } from "../account-security.service";
import { RequireRoles } from "../decorators/roles.decorator";

class PasswordLinkDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  requestId!: string;
  @ApiProperty({ enum: ["setup", "reset"] })
  @IsIn(["setup", "reset"])
  kind!: "setup" | "reset";
}

@Controller("auth")
export class AccountSecurityController {
  constructor(private readonly service: AccountSecurityService) {}

  @Get("users/:userId/security")
  @RequireRoles("SUPER_ADMIN")
  async read(@Param("userId", new ParseUUIDPipe()) userId: string) {
    return this.service.read(userId);
  }

  @Post("users/:userId/password-links")
  @RequireRoles("SUPER_ADMIN")
  async send(@Param("userId", new ParseUUIDPipe()) userId: string, @Body() body: PasswordLinkDto,
    @Req() request: { user: { userId: string } }) {
    const link = await this.service.enqueue({ userId, ...body, actorUserId: request.user.userId });
    return { requestId: link.request_id, state: link.state };
  }

  @Post("activity")
  @HttpCode(204)
  async activity(@Req() request: { user: { userId: string } }) {
    await this.service.activity(request.user.userId);
  }
}
