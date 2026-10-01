import { renderBaseTemplate, type MailContent } from "./base.template";

export function incentiveHandoffContent(input: { companyName: string; period: string; filename: string; detailUrl?: string }): MailContent {
  return {
    title: "Prim listesi onaylandı", icon: "approval", layout: "centered",
    preheader: `${input.companyName} · ${input.period} onaylı prim listesi ektedir.`,
    paragraphs: [],
    action: input.detailUrl ? {label:"📋 Prim detayına git",url:input.detailUrl} : undefined,
  };
}

export function noPositiveSalesContent(alerts: { store_name: string; display_name: string; business_date: string }[]): MailContent {
  return {
    title: "15 gündür aktif satış yok", icon: "people",
    preheader: `${alerts.length} aktif personel için pozitif satış görülmedi.`,
    paragraphs: ["Aşağıdaki aktif personel için son 15 tamamlanmış takvim gününde pozitif satış görülmedi."],
    rows: alerts.map(item => ({ primary: `${item.display_name} · ${item.store_name}`, secondary: `Son yükleme: ${item.business_date}` })),
    notice: { text: "Yalnız başarılı günlük yüklemeler değerlendirilir. İadeler süreyi sıfırlamaz." },
    footnote: "Bu bildirim kadrodan çıkarma veya prim kesintisi oluşturmaz.",
  };
}

export const renderIncentiveHandoff = (input: Parameters<typeof incentiveHandoffContent>[0]) => renderBaseTemplate(incentiveHandoffContent(input));
export const renderNoPositiveSales = (alerts: Parameters<typeof noPositiveSalesContent>[0]) => renderBaseTemplate(noPositiveSalesContent(alerts));
