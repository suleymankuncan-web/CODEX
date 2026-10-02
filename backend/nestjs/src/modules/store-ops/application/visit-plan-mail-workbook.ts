import * as XLSX from 'xlsx-js-style';
import type { VisitPlanMailData } from '../infrastructure/visit-plan-mail-read';
import { dateShift } from '../../../shared/mail/pilot-periods';
export function buildVisitPlanMailWorkbook(plan:VisitPlanMailData) {
  const rows:Array<Array<string|number>>=[['HR Axis · Haftalık ziyaret planı'],[plan.managerName],
    [`${plan.weekStart} – ${dateShift(plan.weekStart,6)} · Türkiye saati`],['Planlanan ziyaret',plan.items.length],[],
    ['Planlanan tarih','Mağaza kodu','Mağaza']];
  for(const item of plan.items)rows.push([item.plannedDate,item.storeCode,item.storeName]);
  if(!plan.items.length)rows.push(['Planlanan ziyaret bulunmuyor']);
  const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols']=[24,24,48].map(wch=>({wch}));sheet['!rows']=rows.map(()=>({hpt:24}));
  for(const [r,row] of rows.entries())for(const [c,value] of row.entries()){
    const cell=sheet[XLSX.utils.encode_cell({r,c})];if(typeof value==='string')cell.t='s';
    const header=r===0 || r===5;
    cell.s={font:{bold:header,color:{rgb:header?'FFFFFF':'1C2436'}},fill:{fgColor:{rgb:header?'484F9C':r%2?'F5F6FC':'FFFFFF'}},alignment:{vertical:'center',wrapText:true}};
  }
  const name=plan.managerName.replace(/[\]:*?/\\[]/g,' ').trim().replace(/^'+|'+$/g,'').trim().slice(0,31).replace(/^'+|'+$/g,'').trim() || 'Bölge Müdürü';
  XLSX.utils.book_append_sheet(book,sheet,name);
  return {fileName:`BM-Ziyaret-Plani-${plan.weekStart}.xlsx`,buffer:Buffer.from(XLSX.write(book,{bookType:'xlsx',type:'buffer',cellStyles:true}))};
}
