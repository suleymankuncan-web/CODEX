import type { MailContent } from "./base.template";
import { trMonth } from "./pilot-periods";

export type WorkflowMailKind = "checklist_completed"|"actions_assigned"|"action_closed"|"action_reminder"|"entry_requested"|"exit_requested"|"target_submitted"|"target_missing"|"target_missing_digest"|"weekly_report"|"monthly_report"|"personnel_roster";
export function workflowMailContent(input:{kind:WorkflowMailKind;storeName?:string;name?:string;period?:string;
  checklistName?:string;actionCount?:number;daysLeft?:number;reviewPending?:boolean;date?:string;code?:string;range?:string;url:string;missingStores?:string[];rosterTotal?:number;rosterActive?:number;rosterPassive?:number}):MailContent {
  const store=input.storeName ?? "";
  const month=input.period ? trMonth(input.period) : "";
  let title=""; let text=""; let action="";
  switch(input.kind) {
    case "checklist_completed": title=`${store} checklisti tamamlandı`;text=`${input.checklistName ?? "Checklist"} · ${input.date ?? ""}`;action="Checklist detayına git";break;
    case "actions_assigned": title=`${store} için aksiyonlar atandı`;text=`${input.actionCount} aksiyon atanmıştır. Terminleri ve ayrıntıları uygulamadan görüntüleyebilirsiniz.`;action="Aksiyonları görüntüle";break;
    case "action_closed": title=`${store} aksiyonu kapatıldı`;text="İlgili aksiyonun kapatılması kaydedildi.";action="Aksiyonları görüntüle";break;
    case "action_reminder":
      title=input.reviewPending ? "Aksiyon çözümü onay bekliyor" : (input.daysLeft ?? 0)<0 ? "Aksiyon termini aşıldı" : "Aksiyon hatırlatması";
      text=input.reviewPending ? `${store} çözümünü gönderdi; inceleme ve onayınız bekleniyor.` : `${store} için açık aksiyonunuz var. ${(input.daysLeft ?? 0)<0 ? "Belirlenen termin geçti." : input.daysLeft===0 ? "Bugün son gün." : `Tamamlamanız için ${input.daysLeft} gün kaldı.`}`;
      action="Aksiyonları görüntüle";break;
    case "entry_requested": title="Personel giriş / sicil talebi";text=`${input.name} · ${store} · ${input.date}. Talep İK onayı bekliyor.`;action="İK taleplerini aç";break;
    case "exit_requested": title="Personel çıkış talebi";text=`${input.name} · ${store} · ${input.date}. Talep İK onayı bekliyor.`;action="İK taleplerini aç";break;
    case "target_submitted": title=`${store} hedeflerini gönderdi`;text=`${month} hedefleri bölge müdürü onayına gönderilmiştir.`;action="Hedefleri görüntüle";break;
    case "target_missing": title=`${month} hedefleri henüz girilmedi`;text=`${store} için gönderilmiş hedef bulunmuyor.`;action="Hedefleri aç";break;
    case "target_missing_digest": title=`${month} hedefleri eksik`;text=`${input.missingStores?.length ?? 0} mağazanın hedefleri henüz gönderilmedi.`;action="Hedefleri aç";break;
    case "weekly_report":title="Geçen hafta bölgenizde durum nasıldı?";text=`${input.range} haftasının mağaza raporu ekte. Ayrıntıları raporlar ekranından inceleyebilirsiniz.`;action="Raporları aç";break;
    case "personnel_roster":title=`${month} aylık personel listesi`;text="Mağaza, pozisyon, ad, soyad, telefon ve işe giriş bilgilerini içeren personel listesi ekte.";break;
    case "monthly_report":title=`${month} aylık bölge raporu`;text="Ayın kapanışı tamamlandı. Mağazalarınızın aylık raporu ekte.";action="Raporları aç";break;
  }
  return {title,preheader:text,icon:(input.kind.includes("requested") || input.kind==='personnel_roster') ? "people" : "approval",layout:"centered",paragraphs:[text],
    ...(input.code ? {facts:[{label:input.kind==='entry_requested' ? 'Talep edilen sicil' : 'Sicil',value:input.code}]} : {}),
    ...(input.missingStores ? {rows:input.missingStores.map(primary=>({primary,secondary:"Hedef gönderilmedi"}))} : {}),...(input.kind==='personnel_roster' ? {facts:[{label:'Toplam personel',value:String(input.rosterTotal ?? 0)},{label:'Aktif / Pasif',value:`${input.rosterActive ?? 0} / ${input.rosterPassive ?? 0}`}]} : {action:{label:action,url:input.url}})};
}
