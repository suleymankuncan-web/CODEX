import * as XLSX from 'xlsx-js-style';
import type { PersonnelRosterMailRow } from '../infrastructure/personnel-roster-mail-read';
export const personnelRosterHeaders=['Mağaza','Pozisyon','Ad','Soyad','Telefon Numarası','İşe Giriş Tarihi','Durum'];
export function buildPersonnelRosterMailWorkbook(rows:PersonnelRosterMailRow[],period:string) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw new Error('personnel_roster_period_invalid');
  const values=[personnelRosterHeaders,...rows.map(row=>[row.store_name ?? '—',row.position_name ?? '—',row.first_name,row.last_name,row.phone_number ?? '—',row.hire_date,row.status])];
  const sheet=XLSX.utils.aoa_to_sheet(values);sheet['!cols']=[24,24,20,20,20,20,12].map(wch=>({wch}));sheet['!autofilter']={ref:`A1:G${values.length}`};
  for(let r=0;r<values.length;r++)for(let c=0;c<7;c++)sheet[XLSX.utils.encode_cell({r,c})].s={
    font:r===0?{bold:true,color:{rgb:'FFFFFF'}}:{color:{rgb:'1C2436'}},fill:{fgColor:{rgb:r===0?'484F9C':r%2?'F5F6FC':'FFFFFF'}},alignment:{vertical:'center'}};
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Personel Listesi');
  return {fileName:`Personel-Listesi-${period}.xlsx`,buffer:Buffer.from(XLSX.write(book,{bookType:'xlsx',type:'buffer',cellStyles:true})),
    total:rows.length,active:rows.filter(row=>row.status==='Aktif').length,passive:rows.filter(row=>row.status==='Pasif').length};
}
