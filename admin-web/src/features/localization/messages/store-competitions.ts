export const storeCompetitionsTr = {
  'storeCompetitions.noStoreScope': 'Yetkili mağaza yok',
  'storeCompetitions.unavailableTitle': 'Yarışma yüzeyi açılamadı',
  'storeCompetitions.unavailableCopy':
    'Bu sayfa mağaza müdürü veya mağaza personeli oturumu gerektirir.',
  'storeCompetitions.loadingTitle': 'Mağaza yarışmaları yükleniyor',
  'storeCompetitions.loadingCopy':
    'Mağaza yarışma sıralamaları kontrol ediliyor.',
  'storeCompetitions.errorTitle': 'Yarışma yüzeyi açılamadı',
  'storeCompetitions.errorCopy': 'Yarışma verisi şu anda alınamadı. Tekrar deneyin.',
  'storeCompetitions.retryAction': 'Tekrar dene',
  'storeCompetitions.retryingAction': 'Tekrar deneniyor...',

  'storeCompetitions.heroEyebrow': 'Mağaza yarışmaları',
  'storeCompetitions.title': 'Mağaza yarışmaları ve katkı skorları.',
  'storeCompetitions.heroCopy':
    'Mağaza kullanıcıları aktif yarışma sıralamalarını ve kendi mağazalarına ait katkı satırlarını görür.',
  'storeCompetitions.storeScope': 'Mağaza',
  'storeCompetitions.storeScopeCount': '{count} mağaza',
  'storeCompetitions.competitions': 'Yarışmalar',
  'storeCompetitions.contributions': 'Katkılar',

  'storeCompetitions.competitionList': 'Yarışma listesi',
  'storeCompetitions.visibleChallenges': 'Görünür yarışmalar',
  'storeCompetitions.readOnly': 'Sadece okuma',
  'storeCompetitions.noVisibleTitle': 'Görünür yarışma yok',
  'storeCompetitions.noVisibleCopy':
    'Yetkili mağazalardan en az biri katıldığında yarışmalar burada görünür.',
  'storeCompetitions.review': 'İncele',
  'storeCompetitions.type': 'Tür',
  'storeCompetitions.state': 'Durum',
  'storeCompetitions.starts': 'Başlangıç',
  'storeCompetitions.ends': 'Bitiş',

  'storeCompetitions.standing': 'Yarışma durumu',
  'storeCompetitions.readSummaryAria': 'Mağaza yarışma okuma özeti',
  'storeCompetitions.warningCount': '{count} uyarı',
  'storeCompetitions.standingLoadingTitle': 'Sıralama yükleniyor',
  'storeCompetitions.standingLoadingCopy': 'Yarışma detayı yükleniyor.',
  'storeCompetitions.standingErrorTitle': 'Sıralama açılamadı',
  'storeCompetitions.standingErrorCopy': 'Yarışma sıralaması şu anda alınamadı. Tekrar deneyin.',
  'storeCompetitions.teams': 'Takımlar',
  'storeCompetitions.teamsNote':
    'Bu yarışma için görünür güncel takım sıralama satırları.',
  'storeCompetitions.contributionRows': 'Katkı satırları',
  'storeCompetitions.scopedContributionsAria': 'Yetkili mağaza yarışma katkıları',
  'storeCompetitions.contributionRowsNote':
    'Yetkili mağazalara ait katkı satırları.',
  'storeCompetitions.warnings': 'Uyarılar',
  'storeCompetitions.scopedWarningsAria': 'Yetkili mağaza yarışma uyarıları',
  'storeCompetitions.warningsNote':
    'Yetkili mağazalara göre filtrelenen veri kalite uyarıları.',
  'storeCompetitions.teamStanding': 'Takım sıralaması',
  'storeCompetitions.latestScores': 'Son skorlar',
  'storeCompetitions.noTeamSnapshot': 'Henüz takım skoru görünümü yok.',
  'storeCompetitions.score': 'Skor',
  'storeCompetitions.coverage': 'Katılım',
  'storeCompetitions.teamCode': 'Takım kodu',
  'storeCompetitions.partialScore': 'Kısmi',
} as const

export const storeCompetitionsEn: Record<keyof typeof storeCompetitionsTr, string> = {
  'storeCompetitions.noStoreScope': 'No authorized store',
  'storeCompetitions.unavailableTitle': 'Competition surface unavailable',
  'storeCompetitions.unavailableCopy':
    'This page requires a store manager or store personnel session.',
  'storeCompetitions.loadingTitle': 'Store competitions are loading',
  'storeCompetitions.loadingCopy':
    'Store competition standings are being checked.',
  'storeCompetitions.errorTitle': 'Competition surface could not load',
  'storeCompetitions.errorCopy': 'Competition data could not be loaded right now. Please try again.',
  'storeCompetitions.retryAction': 'Try again',
  'storeCompetitions.retryingAction': 'Retrying...',

  'storeCompetitions.heroEyebrow': 'Store competitions',
  'storeCompetitions.title': 'Store competitions and contribution scores.',
  'storeCompetitions.heroCopy':
    'Store users see active competition standings and contribution rows for their stores.',
  'storeCompetitions.storeScope': 'Store',
  'storeCompetitions.storeScopeCount': '{count} stores',
  'storeCompetitions.competitions': 'Competitions',
  'storeCompetitions.contributions': 'Contributions',

  'storeCompetitions.competitionList': 'Competition list',
  'storeCompetitions.visibleChallenges': 'Visible challenges',
  'storeCompetitions.readOnly': 'Read only',
  'storeCompetitions.noVisibleTitle': 'No visible competitions',
  'storeCompetitions.noVisibleCopy':
    'Competitions appear here when at least one authorized store participates.',
  'storeCompetitions.review': 'Review',
  'storeCompetitions.type': 'Type',
  'storeCompetitions.state': 'State',
  'storeCompetitions.starts': 'Starts',
  'storeCompetitions.ends': 'Ends',

  'storeCompetitions.standing': 'Standing',
  'storeCompetitions.readSummaryAria': 'Store competition read summary',
  'storeCompetitions.warningCount': '{count} warnings',
  'storeCompetitions.standingLoadingTitle': 'Standing is loading',
  'storeCompetitions.standingLoadingCopy': 'Competition detail is loading.',
  'storeCompetitions.standingErrorTitle': 'Standing could not load',
  'storeCompetitions.standingErrorCopy': 'Competition standing could not be loaded right now. Please try again.',
  'storeCompetitions.teams': 'Teams',
  'storeCompetitions.teamsNote':
    'Current team standing rows visible for this competition.',
  'storeCompetitions.contributionRows': 'Contribution rows',
  'storeCompetitions.scopedContributionsAria': 'Authorized store competition contributions',
  'storeCompetitions.contributionRowsNote':
    'Contribution rows for authorized stores.',
  'storeCompetitions.warnings': 'Warnings',
  'storeCompetitions.scopedWarningsAria': 'Authorized store competition warnings',
  'storeCompetitions.warningsNote':
    'Data quality warnings filtered to authorized stores.',
  'storeCompetitions.teamStanding': 'Team standing',
  'storeCompetitions.latestScores': 'Latest scores',
  'storeCompetitions.noTeamSnapshot': 'No team score snapshot is available yet.',
  'storeCompetitions.score': 'Score',
  'storeCompetitions.coverage': 'Coverage',
  'storeCompetitions.teamCode': 'Team code',
  'storeCompetitions.partialScore': 'Partial',
}
