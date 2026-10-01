import { assertOperationalMailAttachment } from "./operational-mail-attachment";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmail } from "class-validator";
import * as nodemailer from "nodemailer";
import { readFileBackedSetting } from "../../../shared/secret-file-config";
import { renderBaseTemplate, type MailContent } from "../../../shared/mail/base.template";

export class DefiniteOperationalMailRejection extends Error {}
@Injectable()
export class OperationalMailer {
  constructor(private readonly config:ConfigService) {}
  private settings() {
    const value=(key:string)=>this.config.get<string>(`OPERATIONAL_MAIL_SMTP_${key}`)?.trim() || this.config.get<string>(`INCENTIVE_HR_SMTP_${key}`)?.trim();
    const host=value("HOST"),from=value("FROM"),user=value("USER"),port=Number(value("PORT")||"587");
    const pass=readFileBackedSetting(this.config,"OPERATIONAL_MAIL_SMTP_PASSWORD") || readFileBackedSetting(this.config,"INCENTIVE_HR_SMTP_PASSWORD");
    return host && from && isEmail(from) && Number.isInteger(port) && port>0 && port<=65535 && (!user || pass) ? {host,from,user,port,pass} : null;
  }
  ready() {return Boolean(this.settings());}
  private transport(settings:NonNullable<ReturnType<OperationalMailer["settings"]>>) {
    return nodemailer.createTransport({host:settings.host,port:settings.port,secure:settings.port===465,requireTLS:settings.port!==465,
      auth:settings.user ? {user:settings.user,pass:settings.pass!} : undefined,connectionTimeout:10_000,greetingTimeout:10_000,socketTimeout:30_000,
      disableFileAccess:true,disableUrlAccess:true});
  }
  async verify() {const s=this.settings();if(!s) throw new Error("operational_smtp_missing"); const t=this.transport(s);try {await t.verify();} finally {t.close();}}
  async send(input:{recipient:string;deliveryId:string;content:MailContent;report?:{fileName:string;buffer:Buffer}}) {
    const s=this.settings();if(!s || !isEmail(input.recipient)) throw new Error("operational_mail_invalid");
    if(input.report) assertOperationalMailAttachment(input.recipient,input.report);
    const rendered=renderBaseTemplate(input.content);const t=this.transport(s);
    try {
      const result=await t.sendMail({from:s.from,to:input.recipient,subject:`HR Axis | ${input.content.title}`,
        messageId:`<operational-${input.deliveryId}@${s.from.split("@")[1]}>`,...rendered,
        attachments:[...rendered.attachments,...(input.report ? [{filename:input.report.fileName,content:input.report.buffer,contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}] : [])],
      });
      if(!result.accepted.length && result.rejected.length) throw new DefiniteOperationalMailRejection("recipient_rejected");
      if(result.accepted.length!==1 || result.rejected.length || String(result.accepted[0]).toLowerCase()!==input.recipient.toLowerCase()) throw new Error("operational_mail_uncertain");
      return String(result.messageId);
    } catch(error) {
      if(["EAUTH","EENVELOPE"].includes(String((error as {code?:unknown}).code))) throw new DefiniteOperationalMailRejection("pre_data_rejection");
      throw error;
    } finally {t.close();}
  }
}
