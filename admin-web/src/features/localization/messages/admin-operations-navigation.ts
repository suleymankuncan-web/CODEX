export const adminOperationsNavigationTr = {
  'adminOperations.view.label': 'Operasyon görünümü',
  'adminOperations.view.all': 'Tüm sinyaller',
  'adminOperations.view.queues': 'İş kuyrukları',
  'adminOperations.view.system': 'Sistem durumu',
  'adminOperations.actionColumn': 'İşlem',
  'adminOperations.statusReasonColumn': 'Durum ve gerekçe',
  'adminOperations.heroEyebrow': 'Operasyon kontrol kulesi',
  'adminOperations.heroTitle': 'Pilot güven sinyalleri tek ekranda görünmeli.',
} as const

export const adminOperationsNavigationEn: Record<keyof typeof adminOperationsNavigationTr, string> = {
  'adminOperations.view.label': 'Operations view',
  'adminOperations.view.all': 'All signals',
  'adminOperations.view.queues': 'Work queues',
  'adminOperations.view.system': 'System status',
  'adminOperations.actionColumn': 'Action',
  'adminOperations.statusReasonColumn': 'Status and reason',
  'adminOperations.heroEyebrow': 'Operations Control Tower',
  'adminOperations.heroTitle': 'Pilot confidence signals should be visible in one place.',
}
