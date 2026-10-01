import type { MailContent } from "./base.template";

/** Onay mailinde finansal içerik bulunmaz; ayrıntı her zaman yetkili uygulama ekranındadır. */
export function incentiveApprovalContent(input: {
  stage: "region-manager" | "sales-director" | "hr" | "general-manager";
  approverName: string;
  period: string;
  detailUrl: string;
}): MailContent {
  const title = input.stage === "general-manager"
    ? `${input.period} primleri ${input.approverName} tarafından onaylanmıştır.`
    : input.stage === "hr" ? "İnsan Kaynakları prim paketini onayladı."
    : `${input.stage === "region-manager" ? "Bölge Müdürü" : "Satış Direktörü"} ${input.approverName} prim paketini onayladı.`;
  return {
    title, icon: "approval", layout: "centered", preheader: `${input.period} · ${title}`,
    paragraphs: [], action: { label: "📋 Prim detayına git", url: input.detailUrl },
  };
}

/** The daily supervisor remains the owner of attempts/notifications; this only formats its facts. */
export function failedImportContent(input: { date: string; attempts: number; components: string[]; lastAttempt: string }): MailContent {
  return {
    title: "Veri aktarımı tamamlanamadı", icon: "sync",
    preheader: `${input.date} tarihli aktarım için aksiyon gerekiyor.`,
    paragraphs: [`${input.date} tarihli verinin aktarımı tamamlanamadı. Eksik bileşenlerin kontrol edilmesi gerekiyor.`],
    facts: [
      { label: "Eksik bileşenler", value: input.components.join(", ") },
      { label: "Aktarım girişimi", value: String(input.attempts) },
      { label: "Son girişim", value: input.lastAttempt },
    ],
    notice: { tone: "warning", text: "İlgili günün aktarım durumunu kontrol edin. Eksik veriyi tamamlanmış kabul etmeyin." },
  };
}
