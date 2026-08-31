import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiProduces } from '@nestjs/swagger';
import { RequireRoles } from '../../auth/decorators/roles.decorator';
import { RequireScope } from '../../auth/decorators/scope.decorator';
import { IntegrationService } from '../application/integration.service';
import { CreatePersonnelMasterDto } from './dto/create-personnel-master.dto';
import { ListPersonnelMasterQueryDto } from './dto/list-personnel-master.query';
import { TerminatePersonnelMasterDto } from './dto/terminate-personnel-master.dto';
import { UpdatePersonnelMasterDto } from './dto/update-personnel-master.dto';

type RequestUser = {
  user: { userId: string; scope: { companyIds: string[] } };
};
type HeaderResponse = { setHeader(name: string, value: string): unknown };

@Controller('integrations')
export class IntegrationPersonnelMasterController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get('personnel-master')
  @RequireScope('company')
  @RequireRoles('HR_ADMIN', 'SUPER_ADMIN', 'INTEGRATION_ADMIN')
  async listPersonnelMaster(
    @Query() query: ListPersonnelMasterQueryDto,
    @Req() request: RequestUser,
  ) {
    return this.integrationService.listPersonnelMaster({
      actorCompanyIds: request.user.scope.companyIds,
      q: query.q,
      status: query.status,
      storeId: query.storeId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('personnel-master.xlsx')
  @RequireScope('company')
  @RequireRoles('HR_ADMIN', 'SUPER_ADMIN', 'INTEGRATION_ADMIN')
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async downloadPersonnelMaster(
    @Req() request: RequestUser,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const workbook = await this.integrationService.exportPersonnelMaster({
      actorCompanyIds: request.user.scope.companyIds,
    });
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${workbook.fileName}"`,
    );
    return new StreamableFile(workbook.buffer);
  }

  @Post('personnel-master')
  @RequireScope('company')
  @RequireRoles('HR_ADMIN', 'SUPER_ADMIN', 'INTEGRATION_ADMIN')
  async createPersonnelMaster(
    @Body() body: CreatePersonnelMasterDto,
    @Req() request: RequestUser,
  ) {
    return this.integrationService.createPersonnelMaster({
      actorCompanyIds: request.user.scope.companyIds,
      actorUserId: request.user.userId,
      firstName: body.firstName,
      lastName: body.lastName,
      externalEmployeeRef: body.externalEmployeeRef,
      nationalId: body.nationalId,
      phoneNumber: body.phoneNumber,
      employmentType: body.employmentType,
      hireDate: body.hireDate,
      storeId: body.storeId,
      positionId: body.positionId,
    });
  }

  @Get('personnel-master-lookups')
  @RequireScope('company')
  @RequireRoles('HR_ADMIN', 'SUPER_ADMIN', 'INTEGRATION_ADMIN')
  async getPersonnelMasterLookups(@Req() request: RequestUser) {
    return this.integrationService.getPersonnelMasterLookups({
      actorCompanyIds: request.user.scope.companyIds,
    });
  }

  @Patch('personnel-master/:employeeId')
  @ApiParam({ name: 'employeeId', schema: { type: 'string', format: 'uuid' } })
  @RequireScope('company')
  @RequireRoles('HR_ADMIN', 'SUPER_ADMIN', 'INTEGRATION_ADMIN')
  async updatePersonnelMaster(
    @Param('employeeId', new ParseUUIDPipe({ version: '4' })) employeeId: string,
    @Body() body: UpdatePersonnelMasterDto,
    @Req() request: RequestUser,
  ) {
    return this.integrationService.updatePersonnelMaster({
      actorCompanyIds: request.user.scope.companyIds,
      actorUserId: request.user.userId,
      employeeId,
      firstName: body.firstName,
      lastName: body.lastName,
      externalEmployeeRef: body.externalEmployeeRef,
      phoneNumber: body.phoneNumber,
      employmentStatus: body.employmentStatus,
      employmentType: body.employmentType,
      hireDate: body.hireDate,
      storeId: body.storeId,
      positionId: body.positionId,
      assignmentStartDate: body.assignmentStartDate,
      expectedUpdatedAt: body.expectedUpdatedAt,
    });
  }

  @Patch('personnel-master/:employeeId/terminate')
  @ApiParam({ name: 'employeeId', schema: { type: 'string', format: 'uuid' } })
  @RequireScope('company')
  @RequireRoles('HR_ADMIN', 'SUPER_ADMIN', 'INTEGRATION_ADMIN')
  async terminatePersonnelMaster(
    @Param('employeeId', new ParseUUIDPipe({ version: '4' })) employeeId: string,
    @Body() body: TerminatePersonnelMasterDto,
    @Req() request: RequestUser,
  ) {
    return this.integrationService.terminatePersonnelMaster({
      actorCompanyIds: request.user.scope.companyIds,
      actorUserId: request.user.userId,
      employeeId,
      terminationDate: body.terminationDate,
      reason: body.reason,
      expectedUpdatedAt: body.expectedUpdatedAt,
    });
  }
}
