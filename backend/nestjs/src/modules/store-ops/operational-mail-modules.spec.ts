import { Global,Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DatabaseService } from '../../shared/database/database.service';
import { AppConfigService } from '../../shared/app-config.service';
import { StoreOpsOperationalMailModule } from './store-ops-operational-mail.module';
import { StoreOpsIncentiveApprovalMailModule } from './store-ops-incentive-approval-mail.module';
import { StoreOpsReportPackageReadModule } from './store-ops-report-package-read.module';
import { StoreMonthlyReportPackageService } from './application/store-monthly-report-package.service';
import { OperationalMailService } from './application/operational-mail.service';
import { IncentiveApprovalMailService } from './application/incentive-approval-mail.service';

const query=jest.fn();
@Global()
@Module({providers:[{provide:DatabaseService,useValue:{query}},{provide:ConfigService,useValue:new ConfigService({})},
  {provide:AppConfigService,useValue:{rankingFactsCacheEnabled:false}}],exports:[DatabaseService,ConfigService,AppConfigService]})
class FixtureGlobals {}
describe('bounded mail and workbook ownership',()=>{
  it('resolves shared providers and stays inert with pilot defaults, without starting an application server',async()=>{
    const module=await Test.createTestingModule({imports:[FixtureGlobals,StoreOpsOperationalMailModule,StoreOpsIncentiveApprovalMailModule,StoreOpsReportPackageReadModule]}).compile();
    try {
      await module.init();
      expect(module.get(StoreMonthlyReportPackageService)).toBeInstanceOf(StoreMonthlyReportPackageService);
      expect(module.get(OperationalMailService)).toBeInstanceOf(OperationalMailService);
      expect(module.get(IncentiveApprovalMailService)).toBeInstanceOf(IncentiveApprovalMailService);
      expect(query).not.toHaveBeenCalled();
    } finally {await module.close();}
  });
});
