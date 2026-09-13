const messages: Record<string, string> = {
  'Checklist visit started': 'Checklist ziyareti başlatıldı.',
  'Checklist instance acknowledged': 'Checklist sonucu kabul edildi.',
  'Target distribution request submitted for region approval': 'Hedef dağılımı bölge müdürü onayına gönderildi.',
  'Import batch requeued for retry': 'Aktarım yeniden denemek üzere sıraya alındı.',
  'Existing import batch reused via idempotency key': 'Mevcut aktarım kaydı kullanıldı.',
  'Import batch accepted for async processing': 'Aktarım işlenmek üzere sıraya alındı.',
  'Power BI export dosyalari import edildi': 'Power BI dosyaları içeri aktarıldı.',

  'Personnel already has a pending correction': 'Bu personelin İK onayı bekleyen bir düzeltme talebi var. Yeni talep göndermeden önce mevcut talebin sonuçlanmasını bekleyin.',
  'Personnel changed; reload before submitting': 'Personel bilgileri değişti. Sayfayı yenileyip talebinizi yeniden gönderin.',
  'Personnel changed; reject this request and ask for a new correction': 'Personel bilgileri değişti. Bu talebi reddedip güncel bilgilerle yeni bir talep isteyin.',
  'Personnel email changed; submit a new correction': 'Personelin e-posta adresi değişti. Güncel bilgilerle yeni bir düzeltme talebi oluşturun.',
  'Active personnel not found': 'Aktif personel kaydı bulunamadı.',
  'Active store assignment not found': 'Personelin aktif mağaza ataması bulunamadı.',
  'Position must belong to the personnel company': 'Personelin şirketine ait bir pozisyon seçin.',
  'Correction request not found': 'Düzeltme talebi bulunamadı.',
  'Correction already reviewed': 'Bu düzeltme talebi daha önce değerlendirilmiş. Listeyi yenileyin.',
  'Email is already in use': 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.',
  'National ID is already in use': 'Bu TC kimlik numarası başka bir personelde kayıtlı.',
  'Identity synchronization is pending; retry approval later': 'Hesap bilgileri güncelleniyor. Onay işlemini biraz sonra tekrar deneyin.',
  'Store action scope required': 'Bu mağazada işlem yapma yetkiniz bulunmuyor.',
  'Failed to fetch': 'Sunucuya bağlanılamadı. Bağlantınızı kontrol edip tekrar deneyin.',
  'Network Error': 'Bağlantı hatası oluştu. Lütfen tekrar deneyin.',
  'Seller code request submitted for HR approval': 'Personel sicil talebi İK onayına gönderildi.',
  'Seller code request resubmitted for HR approval': 'Personel sicil talebi yeniden İK onayına gönderildi.',
  'Seller code request approved': 'Personel sicil talebi onaylandı.',
  'Seller code request returned to store': 'Personel sicil talebi düzeltme için mağazaya iade edildi.',
  'Offboarding request submitted for HR approval': 'İşten ayrılma talebi İK onayına gönderildi.',
  'Offboarding request resubmitted for HR approval': 'İşten ayrılma talebi yeniden İK onayına gönderildi.',
  'Offboarding request approved': 'İşten ayrılma talebi onaylandı.',
  'Offboarding request returned to store': 'İşten ayrılma talebi düzeltme için mağazaya iade edildi.',
  'Role permission granted': 'Rol yetkisi eklendi.',
  'Role permission revoked': 'Rol yetkisi kaldırıldı.',
  'Feed post created': 'Gönderi oluşturuldu.',
  'Feed post updated': 'Gönderi güncellendi.',
  'Feed post published': 'Gönderi yayınlandı.',
  'Feed post pinned': 'Gönderi sabitlendi.',
  'Feed post unpinned': 'Gönderinin sabitlemesi kaldırıldı.',
  'Feed post archived': 'Gönderi arşivlendi.',
}

export function translatedNotificationMessage(message: string): string | undefined {
  return messages[message.trim().replace(/\.$/, '')]
}

export function notificationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? translatedNotificationMessage(error.message) ?? fallback : fallback
}
