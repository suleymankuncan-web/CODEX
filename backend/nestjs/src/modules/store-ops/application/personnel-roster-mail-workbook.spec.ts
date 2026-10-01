import * as XLSX from 'xlsx-js-style';
import { buildPersonnelRosterMailWorkbook,personnelRosterHeaders } from './personnel-roster-mail-workbook';
import { workflowMailContent } from '../../../shared/mail/workflow.templates';
describe('monthly personnel roster attachment',()=>{
  it('keeps phones as text, names as literal strings and includes inactive/unassigned people without other PII',()=>{
    const workbook=buildPersonnelRosterMailWorkbook([
      {store_name:'Store',position_name:'Manager',first_name:'=SUM(1,2)',last_name:'Literal',phone_number:'05550000001',hire_date:'01.09.2025',status:'Aktif'},
      {store_name:null,position_name:null,first_name:'Former',last_name:'Employee',phone_number:null,hire_date:'12.02.2024',status:'Pasif'},
    ],'2026-10');
    const book=XLSX.read(workbook.buffer,{type:'buffer'}),sheet=book.Sheets['Personel Listesi'];
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1});expect(rows).toHaveLength(3);expect(rows[0]).toEqual(personnelRosterHeaders);
    expect(sheet.E2).toMatchObject({t:'s',v:'05550000001'});expect(sheet.C2).toMatchObject({t:'s',v:'=SUM(1,2)'});expect(sheet.C2.f).toBeUndefined();
    expect(rows[2]).toEqual(['—','—','Former','Employee','—','12.02.2024','Pasif']);expect(workbook).toMatchObject({total:2,active:1,passive:1});
    const content=workflowMailContent({kind:'personnel_roster',period:'2026-10',rosterTotal:2,rosterActive:1,rosterPassive:1,url:'https://hr.example'});
    expect(content.title).toBe('Ekim 2026 aylık personel listesi');expect(content.action).toBeUndefined();expect(content.paragraphs.join(' ')).not.toContain('05550000001');
  });
  it('exports an honest empty roster without inventing employees and rejects an invalid month',()=>{
    expect(buildPersonnelRosterMailWorkbook([],'2026-10')).toMatchObject({total:0,active:0,passive:0});
    expect(()=>buildPersonnelRosterMailWorkbook([],'2026-13')).toThrow('period_invalid');
  });
});
