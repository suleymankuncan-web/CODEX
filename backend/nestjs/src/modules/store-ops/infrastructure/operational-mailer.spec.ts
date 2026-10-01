import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { DefiniteOperationalMailRejection,OperationalMailer } from './operational-mailer';
import { workflowMailContent } from '../../../shared/mail/workflow.templates';
jest.mock('nodemailer',()=>({createTransport:jest.fn()}));
describe('operational SMTP adapter',()=>{
  const sendMail=jest.fn(),verify=jest.fn(),close=jest.fn();
  const settings={OPERATIONAL_MAIL_SMTP_HOST:'smtp.example.test',OPERATIONAL_MAIL_SMTP_PORT:'587',OPERATIONAL_MAIL_SMTP_FROM:'axis@example.test'};
  const input={recipient:'store@example.test',deliveryId:'receipt',content:workflowMailContent({kind:'checklist_completed',storeName:'Store',url:'https://hr.example/store/checklists'})};
  beforeEach(()=>{jest.resetAllMocks();(nodemailer.createTransport as jest.Mock).mockReturnValue({sendMail,verify,close});
    sendMail.mockResolvedValue({accepted:[input.recipient],rejected:[],messageId:'accepted'});});
  it('requires valid complete settings and never sends without configured auth secret',()=>{
    expect(new OperationalMailer(new ConfigService({})).ready()).toBe(false);
    expect(new OperationalMailer(new ConfigService({...settings,OPERATIONAL_MAIL_SMTP_USER:'user'})).ready()).toBe(false);
    expect(new OperationalMailer(new ConfigService({...settings,OPERATIONAL_MAIL_SMTP_PORT:'0'})).ready()).toBe(false);
  });
  it('uses TLS, stable receipt ID and inline images without a workbook for notifications',async()=>{
    const mailer=new OperationalMailer(new ConfigService(settings));await mailer.verify();await expect(mailer.send(input)).resolves.toBe('accepted');
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({requireTLS:true,disableFileAccess:true,disableUrlAccess:true}));
    expect(sendMail.mock.calls[0][0]).toMatchObject({to:input.recipient,messageId:'<operational-receipt@example.test>',attachments:expect.any(Array)});
    expect(sendMail.mock.calls[0][0].attachments).toHaveLength(2);expect(close).toHaveBeenCalledTimes(2);
  });
  it('only permits the report workbook namespace and exact one-recipient acceptance',async()=>{
    const mailer=new OperationalMailer(new ConfigService(settings));
    await expect(mailer.send({...input,report:{fileName:'Primler-2026-09.xlsx',buffer:Buffer.from('x')}})).rejects.toThrow('operational_report_invalid');
    await mailer.send({...input,report:{fileName:'magaza-izleyis-2026-09.xlsx',buffer:Buffer.from('report')}});
    expect(sendMail.mock.calls[0][0].attachments).toHaveLength(3);
    sendMail.mockResolvedValueOnce({accepted:['someone-else@example.test'],rejected:[],messageId:'wrong'});
    await expect(mailer.send(input)).rejects.toThrow('operational_mail_uncertain');
  });
  it('permits personnel exports only to the two explicitly authorized CRM/HR addresses',async()=>{
    const mailer=new OperationalMailer(new ConfigService(settings));const report={fileName:'Personel-Listesi-2026-10.xlsx',buffer:Buffer.from('roster')};
    await expect(mailer.send({...input,report})).rejects.toThrow('operational_report_invalid');expect(sendMail).not.toHaveBeenCalled();
    for(const recipient of ['crm@lufian.com.tr','ik@lufian.com.tr']) {
      sendMail.mockResolvedValueOnce({accepted:[recipient],rejected:[],messageId:'ok'});
      await expect(mailer.send({...input,recipient,report})).resolves.toBe('ok');
    }
    await expect(mailer.send({...input,recipient:'crm@lufian.com.tr',report:{...report,fileName:'Primler-2026-10.xlsx'}})).rejects.toThrow('operational_report_invalid');
  });
  it('distinguishes definite rejection from ambiguous post-DATA timeouts and closes both',async()=>{
    const mailer=new OperationalMailer(new ConfigService(settings));sendMail.mockResolvedValueOnce({accepted:[],rejected:[input.recipient]});
    await expect(mailer.send(input)).rejects.toBeInstanceOf(DefiniteOperationalMailRejection);
    const timeout=Object.assign(new Error('timeout'),{code:'ETIMEDOUT'});sendMail.mockRejectedValueOnce(timeout);
    await expect(mailer.send(input)).rejects.toBe(timeout);expect(close).toHaveBeenCalledTimes(2);
  });
});
