import type { AppLocale } from '@/lib/i18n'

const tr = {
  eyebrow: 'Store · Hedefler', regionTitle: 'Hedef Kontrol Masası', viewerTitle: 'Şirket hedef görünümü',
  regionDescription: 'Atanmış mağazaların hedef dağılımlarını kontrol edin ve bekleyen kararları tamamlayın.',
  viewerDescription: 'Bölge ve mağaza hedef durumlarını salt okunur izleyin.',
  totalStores: 'Toplam mağaza', totalTarget: 'Toplam hedef', selectedPeriod: 'Seçili dönem', regionPortfolio: 'Yetkili portföy', companyScope: 'Şirket kapsamı',
  approved: 'Onaylanan', approvedNote: 'Kararı tamamlanan', pending: 'Onay bekleyen', pendingNote: 'Gönderildi · karar bekliyor',
  missing: 'Hedef bekleniyor', missingNote: 'Henüz gönderilmedi', regions: 'Bölge müdürleri', regionsNote: 'Şirket hiyerarşisi',
  viewerHierarchyHint: 'Bir bölgeyi açarak yetkili mağazaların hedef durumunu inceleyin.', regionManagerCount: 'bölge müdürü',
  search: 'Mağaza, bölge veya müdür ara', status: 'Durum', allStatuses: 'Tüm durumlar', clear: 'Temizle', updating: 'Hedefler güncelleniyor',
  store: 'Mağaza', target: 'Mağaza hedefi', distributed: 'Dağıtılan', personnel: 'Personel', state: 'Durum',
  noMatch: 'Bu filtrede hedef kaydı yok.', emptyTitle: 'Yetkili hedef kaydı bulunamadı', emptyCopy: 'Seçili dönem ve yetki kapsamı için mağaza bulunmuyor.',
  partialTitle: 'Bazı hedef bilgileri eksik', partialCopy: 'Kullanılabilen veriler gösteriliyor; eksik bölüm tekrar denenebilir.', retry: 'Tekrar dene',
  loadMore: 'Daha fazla mağaza göster', loadingMore: 'Mağazalar yükleniyor',
  managerFallback: 'Bölge müdürü atanmamış', regionFallback: 'Bölge bilgisi yok', stores: 'mağaza', decisionWaiting: 'karar bekliyor',
  detail: 'Hedef detayı', requestNote: 'Mağaza notu', audit: 'Kayıt izi', submitted: 'Gönderim', approvedAt: 'Onay zamanı', decisionNote: 'Karar notu',
  close: 'Kapat', approve: 'Onayla', approving: 'Onaylanıyor', balance: 'Kalan bakiye', allocation: 'Personel hedef dağılımı',
  editHint: 'Hedefi değiştirmek için tutarı düzenleyin; bakiye sıfırken onaylayın.', readOnlyHint: 'Bu görünüm hedef kaydını değiştirmez.',
  approvalNote: 'Bölge karar notu', approvalNotePlaceholder: 'Düzenlenmiş onay için zorunlu karar notu', noPersonnel: 'Bu kayıtta personel hedef dağılımı bulunmuyor.',
  requestFailed: 'Hedef çalışma alanı açılamadı.', approvalFailed: 'Hedef kararı kaydedilemedi.', approvedSuccess: 'Hedef kararı kaydedildi.',
  returned: 'İade edildi', selectPeriod: 'Hedef dönemini seçin', viewedPeriod: 'Görüntülenen dönem', showing: 'gösteriliyor', of: '/',
  loadingTitle: 'Hedefler yükleniyor', loadingCopy: 'Yetkili mağaza kapsamı hazırlanıyor.', failureCopy: 'Bağlantıyı kontrol edip yeniden deneyin.',
} as const

const en: Record<keyof typeof tr, string> = {
  eyebrow: 'Store · Targets', regionTitle: 'Target Control Desk', viewerTitle: 'Company target view',
  regionDescription: 'Manage store targets, personnel allocation and region decisions in one workspace.',
  viewerDescription: 'Review Region Managers and every store target status in a read-only hierarchy.',
  totalStores: 'Total stores', totalTarget: 'Total target', selectedPeriod: 'Selected period', regionPortfolio: 'Authorized portfolio', companyScope: 'Company scope',
  approved: 'Approved', approvedNote: 'Decision completed', pending: 'Awaiting approval', pendingNote: 'Submitted · awaiting decision',
  missing: 'Target awaited', missingNote: 'Not submitted yet', regions: 'Region Managers', regionsNote: 'Company hierarchy',
  viewerHierarchyHint: 'Open a region to review its authorized stores and target status.', regionManagerCount: 'Region Managers',
  search: 'Search store, region or manager', status: 'Status', allStatuses: 'All statuses', clear: 'Clear', updating: 'Targets are updating',
  store: 'Store', target: 'Store target', distributed: 'Distributed', personnel: 'Personnel', state: 'Status',
  noMatch: 'No target record matches these filters.', emptyTitle: 'No authorized target record', emptyCopy: 'No store exists for the selected period and scope.',
  partialTitle: 'Some target data is unavailable', partialCopy: 'Available data remains visible; retry the missing section.', retry: 'Retry',
  loadMore: 'Show more stores', loadingMore: 'Loading stores',
  managerFallback: 'Region Manager unassigned', regionFallback: 'Region unavailable', stores: 'stores', decisionWaiting: 'awaiting decision',
  detail: 'Target detail', requestNote: 'Store note', audit: 'Audit trail', submitted: 'Submitted', approvedAt: 'Approved at', decisionNote: 'Decision note',
  close: 'Close', approve: 'Approve', approving: 'Approving', balance: 'Remaining balance', allocation: 'Personnel target allocation',
  editHint: 'Edit an amount and approve when the remaining balance is zero.', readOnlyHint: 'This view cannot change the target record.',
  approvalNote: 'Region decision note', approvalNotePlaceholder: 'Required note for an adjusted approval', noPersonnel: 'No personnel allocation exists for this record.',
  requestFailed: 'The target workspace could not be opened.', approvalFailed: 'The target decision could not be saved.', approvedSuccess: 'The target decision was saved.',
  returned: 'Returned', selectPeriod: 'Select target period', viewedPeriod: 'Viewed period', showing: 'showing', of: '/',
  loadingTitle: 'Loading targets', loadingCopy: 'Preparing the authorized store scope.', failureCopy: 'Check the connection and try again.',
}

export function getTargetCommandCopy(locale: AppLocale) { return locale === 'tr' ? tr : en }
