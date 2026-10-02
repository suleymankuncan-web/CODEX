import { visitPlanRecipient } from './visit-plan-mail-read';
import { isPersonnelRosterRecipient } from '../../../shared/mail/personnel-roster-recipients';
export function assertOperationalMailAttachment(recipient:string,report:{fileName:string;buffer:Buffer}) {
  const roster=report.fileName.startsWith('Personel-Listesi-');
  const visitPlan=report.fileName.startsWith('BM-Ziyaret-Plani-');
  const allowed=visitPlan ? recipient.trim().toLowerCase()===visitPlanRecipient && /^BM-Ziyaret-Plani-\d{4}-\d{2}-\d{2}\.xlsx$/.test(report.fileName) : roster ? isPersonnelRosterRecipient(recipient) && /^Personel-Listesi-\d{4}-(0[1-9]|1[0-2])\.xlsx$/.test(report.fileName)
    : /^magaza-izleyis-(?:\d{4}-\d{2}|haftalik-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2})\.xlsx$/.test(report.fileName);
  if(!allowed || report.buffer.length>15*1024*1024)throw new Error('operational_report_invalid');
}
