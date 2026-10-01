import * as XLSX from '@e965/xlsx';
import type { HrPackageRow } from '../infrastructure/incentive-hr-handoff.repository';
/** Extra context comes only from the approved archive/immutable package copy, never today's drawer. */
export function appendIncentiveHrContext(book:XLSX.WorkBook,period:string,packages:HrPackageRow[]) {
  const notes=packages.filter(p=>p.submission_note?.trim());
  if(notes.length) append(book,'Paket Notları',[['Dönem','Bölge Müdürü','Paket Notu'],...notes.map(p=>[period,p.manager_name,p.submission_note!])],[14,26,70]);
  const stores=packages.flatMap(p=>(p.store_details ?? []).map(store=>({store,manager:p.manager_name})));
  if(stores.length)append(book,'Mağaza Özeti',[
    ['Dönem','Bölge Müdürü','Mağaza Kodu','Mağaza','Hedef (TL)','Toplam Satış (TL)','İade Tutarı (TL)','Net Satış (TL)','HG %'],
    ...stores.map(({store,manager})=>[period,manager,store.storeCode,store.storeName,number(store.target),number(store.gross),number(store.returns),number(store.net),number(store.achievement)]),
  ],[14,26,18,30,20,20,20,20,12]);
  const excluded=packages.flatMap(p=>(p.frozen_participation ?? []).flatMap(store=>store.exclusions.map(person=>({
    person,store:p.store_details?.find(s=>s.storeId===store.storeId),storeId:store.storeId,manager:p.manager_name,
  }))));
  if(excluded.length)append(book,'Prime Dahil Değildir',[
    ['Dönem','Bölge Müdürü','Mağaza','Personel','Pozisyon','Durum','Katılım Notu','Ödenecek Prim (TL)'],
    ...excluded.map(({person,store,storeId,manager})=>[period,manager,store?.storeName ?? storeId,person.displayName,person.positionCode,'Prime dahil değildir',person.reasonNote,0]),
  ],[14,26,30,26,26,24,70,24]);
}
function number(value:string|null|undefined) {return value==null?null:Number(value);}
function append(book:XLSX.WorkBook,name:string,values:(string|number|null)[][],widths:number[]) {
  const sheet=XLSX.utils.aoa_to_sheet(values);sheet['!cols']=widths.map(wch=>({wch}));sheet['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:values.length-1,c:widths.length-1}})};
  XLSX.utils.book_append_sheet(book,sheet,name);
}
