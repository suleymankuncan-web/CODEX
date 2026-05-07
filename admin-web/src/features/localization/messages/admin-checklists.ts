export const adminChecklistsTr = {
  'adminChecklists.heroEyebrow': 'Checklistler',
  'adminChecklists.heroTitle': 'HR şablonları, yayınlanmadan önce taslak olarak hazırlanır.',
  'adminChecklists.heroCopy':
    'Bu pilot yüzey şablon sahipliğini HR tarafında tutar; yayınlama ve ağırlık kontrolü backend güvenlik kapılarından geçer.',
  'adminChecklists.draftPilot': 'Taslak pilot',
  'adminChecklists.templateStatusTitle': 'Şablon durumu',
  'adminChecklists.templateStatusNote': 'Versiyonlu checklist şablon omurgası backend tarafında hazır.',
  'adminChecklists.publishRuleTitle': 'Yayın kuralı',
  'adminChecklists.publishRuleNote': 'Kalem ağırlıkları toplamı 100 olmadan yayın kapısı açılmaz.',
  'adminChecklists.templateDraftEyebrow': 'Şablon Taslağı',
  'adminChecklists.templateManagementTitle': 'HR checklist şablon yönetimi',
  'adminChecklists.controlled': 'Kontrollü',
  'adminChecklists.templateType': 'Şablon tipi',
  'adminChecklists.answerType': 'Cevap tipi',
  'adminChecklists.scoring': 'Puanlama',
  'adminChecklists.publishControl': 'Yayın kontrolü',
  'adminChecklists.weightTotal': 'Ağırlık toplamı 100',
  'adminChecklists.nextLink': 'Sonraki bağ',
  'adminChecklists.fullFormEditor': 'Tam form editörü',
  'adminChecklists.editorNextTitle': 'Form editörü sıradaki küçük parça',
  'adminChecklists.editorNextCopy':
    'Bu ekran şimdilik route ve bilgi mimarisini açar; detaylı editör kontrollü şekilde ayrıca eklenecek.',
} as const

export const adminChecklistsEn: Record<keyof typeof adminChecklistsTr, string> = {
  'adminChecklists.heroEyebrow': 'Checklists',
  'adminChecklists.heroTitle': 'HR templates are drafted before publication.',
  'adminChecklists.heroCopy':
    'This pilot surface keeps template ownership on the HR side; publication and weight controls pass through backend security gates.',
  'adminChecklists.draftPilot': 'Draft pilot',
  'adminChecklists.templateStatusTitle': 'Template status',
  'adminChecklists.templateStatusNote': 'Versioned checklist template backbone is ready on the backend.',
  'adminChecklists.publishRuleTitle': 'Publish rule',
  'adminChecklists.publishRuleNote': 'The publish gate stays closed until item weights total 100.',
  'adminChecklists.templateDraftEyebrow': 'Template Draft',
  'adminChecklists.templateManagementTitle': 'HR checklist template management',
  'adminChecklists.controlled': 'Controlled',
  'adminChecklists.templateType': 'Template type',
  'adminChecklists.answerType': 'Answer type',
  'adminChecklists.scoring': 'Scoring',
  'adminChecklists.publishControl': 'Publish control',
  'adminChecklists.weightTotal': 'Weight total 100',
  'adminChecklists.nextLink': 'Next link',
  'adminChecklists.fullFormEditor': 'Full form editor',
  'adminChecklists.editorNextTitle': 'Form editor is the next small slice',
  'adminChecklists.editorNextCopy':
    'For now this screen opens the route and information architecture; the detailed editor will be added separately in a controlled slice.',
}
