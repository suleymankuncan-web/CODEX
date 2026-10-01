import * as XLSX from '@e965/xlsx';
import { STORE_MONTHLY_REPORT_PACKAGE_HEADERS,StoreMonthlyReportPackageService } from './store-monthly-report-package.service';
describe('weekly manager workbook',()=>{
  it('keeps existing report columns, real interval, percent units and honest monthly context',async()=>{
    const row={region_manager_name:'BM',store_id:'store',store_name:'Store',region_name:'Region',store_type:'company',
      score_value:null,upt_value:'3',atv_value:'100',cr_value:'0.1',hg_value:'0.5',gsm_value:'0.75',
      bm_checklist_score:'80',vm_checklist_score:null,pending_ack_count:'0',open_action_count:'0',closed_action_count:'0',
      target_status:null,incentive_status:null,incentive_total_amount:null,planned_headcount:null,active_headcount:'4',
      leaver_count:'0',turnover_rate:null,last_visit_date:null,days_since_visit:null};
    const repository={getStoreWeeklyReportPackageRows:jest.fn(async()=>[row])};
    const service=new StoreMonthlyReportPackageService(repository as never);
    const workbook=await service.buildWeeklyWorkbook({period:'2026-10',periodStart:'2026-09-28',periodEnd:'2026-10-04',today:'2026-10-05',companyIds:[],regionIds:[],storeIds:['store']});
    expect(workbook.fileName).toBe('magaza-izleyis-haftalik-2026-09-28-2026-10-04.xlsx');
    const decoded=XLSX.read(workbook.buffer,{type:'buffer'});const rows=XLSX.utils.sheet_to_json<string[]>(decoded.Sheets[decoded.SheetNames[0]],{header:1});
    expect(rows[0]).toEqual(STORE_MONTHLY_REPORT_PACKAGE_HEADERS);
    expect(rows[1][4]).toBe('2026-09-28 – 2026-10-04');expect(rows[1][8]).toBe('%10');expect(rows[1][9]).toBe('%0,50');expect(rows[1][10]).toBe('%75');
    expect(rows[1][19]).toBe('Checklist yapılmadı');expect(rows[1][21]).toContain('Hedef/prim durumu: 2026-10');
  });
  it('rejects a current/unclosed or partial week before querying data',async()=>{
    const repository={getStoreWeeklyReportPackageRows:jest.fn()};const service=new StoreMonthlyReportPackageService(repository as never);
    await expect(service.buildWeeklyWorkbook({period:'2026-10',periodStart:'2026-09-28',periodEnd:'2026-10-04',today:'2026-10-04',companyIds:[],regionIds:[],storeIds:['store']})).rejects.toThrow('mail_week_must_be_closed');
    expect(repository.getStoreWeeklyReportPackageRows).not.toHaveBeenCalled();
  });
});
