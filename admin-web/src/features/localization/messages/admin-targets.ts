export const adminTargetsTr = {
  'adminTargets.loadingTitle': 'Hedef onayları yükleniyor',
  'adminTargets.loadingCopy':
    'Bölge onayı bekleyen mağaza kaynaklı hedef dağıtım talepleri alınıyor.',
  'adminTargets.errorTitle': 'Hedef onay kuyruğu açılamadı',

  'adminTargets.heroEyebrow': 'Hedef onayları',
  'adminTargets.title':
    'Mağazadan gelen hedef dağıtım talepleri için bölge onay kuyruğu.',
  'adminTargets.heroCopy':
    'Mağazalardan gelen aylık hedef dağıtım taleplerini, personel kapsamını ve son kararları tek ekranda takip edin.',
  'adminTargets.actionStores': 'Aksiyon mağazaları',
  'adminTargets.none': 'Yok',

  'adminTargets.pendingApprovals': 'Bekleyen onaylar',
  'adminTargets.pendingApprovalsNote': 'Hâlâ bölge onayı bekleyen talepler.',
  'adminTargets.recentlyApproved': 'Son onaylananlar',
  'adminTargets.recentlyApprovedNote': 'Mevcut kuyruk kesitinde görünen onaylı talepler.',

  'adminTargets.coverageEyebrow': 'Hedef referans kapsamı',
  'adminTargets.coverageTitle': 'Onaylı personel hedef hazırlığı',
  'adminTargets.needsReview': 'İnceleme gerekli',
  'adminTargets.complete': 'Tamamlandı',
  'adminTargets.coverageLoading': 'Hedef kapsamı yükleniyor...',
  'adminTargets.coveredPersonnel': 'Kapsanan personel',
  'adminTargets.pendingApproval': 'Onay bekliyor',
  'adminTargets.pendingChanges': 'Bekleyen değişiklikler',
  'adminTargets.staleReferences': 'Eski referanslar',
  'adminTargets.missingTargets': 'Eksik hedefler',
  'adminTargets.coverageRate': 'Kapsam oranı',
  'adminTargets.personnelInScope': 'Kapsamdaki personel',
  'adminTargets.noCoverageIssuesTitle': 'Hedef kapsam sorunu yok',
  'adminTargets.noCoverageIssuesCopy':
    'Onaylı personel hedef referansları mevcut ayı bekleyen veya eski kayıt olmadan kapsıyor.',

  'adminTargets.approvalQueue': 'Onay kuyruğu',
  'adminTargets.pendingRequestsTitle': 'Bekleyen hedef dağıtım talepleri',
  'adminTargets.needsAttention': 'Aksiyon gerekli',
  'adminTargets.clear': 'Temiz',
  'adminTargets.noPendingTitle': 'Bekleyen talep yok',
  'adminTargets.noPendingCopy':
    'Mağaza müdürleri henüz bölge onayı gerektiren hedef dağıtım talebi göndermedi.',

  'adminTargets.recentHistory': 'Yakın geçmiş',
  'adminTargets.recentlyApprovedTitle': 'Son onaylanan hedef talepleri',
  'adminTargets.visible': 'Görünür',
  'adminTargets.noHistoryYet': 'Henüz geçmiş yok',
  'adminTargets.noApprovedTitle': 'Henüz onaylı talep yok',
  'adminTargets.noApprovedCopy':
    'Onaylı talepler burada görünür kalır; bölge tarafındaki kullanıcılar son kararları inceleyebilir.',

  'adminTargets.requestSummary': '{store} için {month} ayı hedef dağıtım talebi.',
  'adminTargets.totalTarget': 'Toplam hedef',
  'adminTargets.allocationCount': 'Dağıtım sayısı',
  'adminTargets.approvedAt': 'Onay zamanı',
  'adminTargets.approver': 'Onaylayan',
  'adminTargets.unknown': 'Bilinmiyor',
  'adminTargets.sellerCode': 'Satıcı kodu',
  'adminTargets.approvedTarget': 'Onaylı hedef',
  'adminTargets.pendingTarget': 'Bekleyen hedef',
  'adminTargets.referenceState': 'Referans durumu',
  'adminTargets.submission': 'Gönderim',
  'adminTargets.requestOwner': 'Talep sahibi',
  'adminTargets.reason': 'Gerekçe: {reason}',
  'adminTargets.urgency': 'Öncelik: {urgency}',
  'adminTargets.approvalNote': 'Onay notu',
  'adminTargets.optionalRegionNote': 'İsteğe bağlı bölge notu',
  'adminTargets.approving': 'Onaylanıyor...',
  'adminTargets.approveRequest': 'Talebi onayla',
  'adminTargets.assignedStoreOnly':
    'Bu oturum talebi inceleyebilir, ancak onay yalnızca atanmış aksiyon mağazalarıyla sınırlıdır.',
  'adminTargets.approvedAtMessage': '{date} tarihinde onaylandı',
  'adminTargets.approvedAtMessageWithNote': '{date} tarihinde onaylandı - {note}',

  'adminTargets.status.pending_region_approval': 'Onay bekliyor',
  'adminTargets.status.pending_change_conflict': 'Bekleyen değişiklik',
  'adminTargets.status.stale_reference': 'Eski referans',
  'adminTargets.status.missing': 'Eksik hedef',
  'adminTargets.status.approved': 'Onaylandı',
  'adminTargets.value.none': 'Yok',
  'adminTargets.reference.storeMismatch': 'Mağaza uyumsuzluğu',
  'adminTargets.reference.approved': 'Onaylı referans',
  'adminTargets.reference.waitingApproval': 'Onay bekliyor',
  'adminTargets.reference.none': 'Onaylı referans yok',
  'adminTargets.urgency.high': 'Yüksek',
  'adminTargets.urgency.medium': 'Orta',
  'adminTargets.urgency.low': 'Düşük',
} as const

export const adminTargetsEn: Record<keyof typeof adminTargetsTr, string> = {
  'adminTargets.loadingTitle': 'Loading target approvals',
  'adminTargets.loadingCopy':
    'Pulling store-submitted target distribution requests that are waiting on region approval.',
  'adminTargets.errorTitle': 'Target approval queue unavailable',

  'adminTargets.heroEyebrow': 'Target Approvals',
  'adminTargets.title':
    'Region approval queue for store-submitted target distribution requests.',
  'adminTargets.heroCopy':
    'Track monthly target distribution requests, personnel coverage, and recent decisions from one operational screen.',
  'adminTargets.actionStores': 'Action stores',
  'adminTargets.none': 'None',

  'adminTargets.pendingApprovals': 'Pending approvals',
  'adminTargets.pendingApprovalsNote':
    'Requests still waiting on region-side approval.',
  'adminTargets.recentlyApproved': 'Recently approved',
  'adminTargets.recentlyApprovedNote':
    'Approved requests visible in the current queue slice.',

  'adminTargets.coverageEyebrow': 'Target Reference Coverage',
  'adminTargets.coverageTitle': 'Approved personnel target readiness',
  'adminTargets.needsReview': 'Needs review',
  'adminTargets.complete': 'Complete',
  'adminTargets.coverageLoading': 'Loading target coverage...',
  'adminTargets.coveredPersonnel': 'Covered personnel',
  'adminTargets.pendingApproval': 'Pending approval',
  'adminTargets.pendingChanges': 'Pending changes',
  'adminTargets.staleReferences': 'Stale references',
  'adminTargets.missingTargets': 'Missing targets',
  'adminTargets.coverageRate': 'Coverage rate',
  'adminTargets.personnelInScope': 'Personnel in scope',
  'adminTargets.noCoverageIssuesTitle': 'No target coverage issues',
  'adminTargets.noCoverageIssuesCopy':
    'Approved personnel target references cover the current month without pending or stale items.',

  'adminTargets.approvalQueue': 'Approval Queue',
  'adminTargets.pendingRequestsTitle': 'Pending target distribution requests',
  'adminTargets.needsAttention': 'Needs attention',
  'adminTargets.clear': 'Clear',
  'adminTargets.noPendingTitle': 'No pending requests',
  'adminTargets.noPendingCopy':
    'Store managers have not submitted any target distribution requests that require region approval yet.',

  'adminTargets.recentHistory': 'Recent History',
  'adminTargets.recentlyApprovedTitle': 'Recently approved target requests',
  'adminTargets.visible': 'Visible',
  'adminTargets.noHistoryYet': 'No history yet',
  'adminTargets.noApprovedTitle': 'No approved requests yet',
  'adminTargets.noApprovedCopy':
    'Approved requests will remain visible here so region-side operators can review the latest decisions.',

  'adminTargets.requestSummary': 'Target distribution request for {store} in {month}.',
  'adminTargets.totalTarget': 'Total target',
  'adminTargets.allocationCount': 'Allocation count',
  'adminTargets.approvedAt': 'Approved at',
  'adminTargets.approver': 'Approver',
  'adminTargets.unknown': 'Unknown',
  'adminTargets.sellerCode': 'Seller code',
  'adminTargets.approvedTarget': 'Approved target',
  'adminTargets.pendingTarget': 'Pending target',
  'adminTargets.referenceState': 'Reference state',
  'adminTargets.submission': 'Submission',
  'adminTargets.requestOwner': 'Request owner',
  'adminTargets.reason': 'Reason: {reason}',
  'adminTargets.urgency': 'Urgency: {urgency}',
  'adminTargets.approvalNote': 'Approval note',
  'adminTargets.optionalRegionNote': 'Optional region-side note',
  'adminTargets.approving': 'Approving...',
  'adminTargets.approveRequest': 'Approve request',
  'adminTargets.assignedStoreOnly':
    'This session can review the request, but approval is limited to assigned action stores.',
  'adminTargets.approvedAtMessage': 'Approved at {date}',
  'adminTargets.approvedAtMessageWithNote': 'Approved at {date} - {note}',

  'adminTargets.status.pending_region_approval': 'Pending approval',
  'adminTargets.status.pending_change_conflict': 'Pending change',
  'adminTargets.status.stale_reference': 'Stale reference',
  'adminTargets.status.missing': 'Missing target',
  'adminTargets.status.approved': 'Approved',
  'adminTargets.value.none': 'None',
  'adminTargets.reference.storeMismatch': 'Store mismatch',
  'adminTargets.reference.approved': 'Approved reference',
  'adminTargets.reference.waitingApproval': 'Waiting approval',
  'adminTargets.reference.none': 'No approved reference',
  'adminTargets.urgency.high': 'High',
  'adminTargets.urgency.medium': 'Medium',
  'adminTargets.urgency.low': 'Low',
}
