export const storeCompetitionsTr = {
  'storeCompetitions.noStoreScope': 'Mağaza kapsamı yok',
  'storeCompetitions.unavailableTitle': 'Yarışma yüzeyi açılamadı',
  'storeCompetitions.unavailableCopy':
    'Bu mağaza rotası mağaza müdürü veya mağaza personeli oturumu gerektirir.',
  'storeCompetitions.loadingTitle': 'Mağaza yarışmaları yükleniyor',
  'storeCompetitions.loadingCopy':
    'Mağaza alanı kapsamlı yarışma sıralamalarını kontrol ediyor.',
  'storeCompetitions.errorTitle': 'Yarışma yüzeyi açılamadı',
  'storeCompetitions.retryAction': 'Tekrar dene',
  'storeCompetitions.retryingAction': 'Tekrar deneniyor...',

  'storeCompetitions.heroEyebrow': 'Mağaza yarışmaları',
  'storeCompetitions.title': 'Mağaza yarışmaları ve kapsamdaki katkı skorları.',
  'storeCompetitions.heroCopy':
    'Mağaza kullanıcıları aktif yarışma sıralamalarını ve çözülen okuma kapsamına ait katkı satırlarını görür.',
  'storeCompetitions.route': 'Rota',
  'storeCompetitions.storeScope': 'Mağaza kapsamı',
  'storeCompetitions.competitions': 'Yarışmalar',
  'storeCompetitions.contributions': 'Katkılar',

  'storeCompetitions.competitionList': 'Yarışma listesi',
  'storeCompetitions.visibleChallenges': 'Görünür yarışmalar',
  'storeCompetitions.readOnly': 'Sadece okuma',
  'storeCompetitions.noVisibleTitle': 'Görünür yarışma yok',
  'storeCompetitions.noVisibleCopy':
    'Kapsamdaki en az bir mağaza katıldığında yarışmalar burada görünür.',
  'storeCompetitions.review': 'İncele',
  'storeCompetitions.type': 'Tür',
  'storeCompetitions.state': 'Durum',
  'storeCompetitions.starts': 'Başlangıç',
  'storeCompetitions.ends': 'Bitiş',

  'storeCompetitions.standing': 'Yarışma durumu',
  'storeCompetitions.readSummaryAria': 'Mağaza yarışma okuma özeti',
  'storeCompetitions.warningCount': '{count} uyarı',
  'storeCompetitions.standingLoadingTitle': 'Sıralama yükleniyor',
  'storeCompetitions.standingLoadingCopy': 'Kapsamlı yarışma detayı yükleniyor.',
  'storeCompetitions.standingErrorTitle': 'Sıralama açılamadı',
  'storeCompetitions.teams': 'Takımlar',
  'storeCompetitions.teamsNote':
    'Bu yarışma için görünür güncel takım sıralama satırları.',
  'storeCompetitions.contributionRows': 'Katkı satırları',
  'storeCompetitions.scopedContributionsAria': 'Kapsamdaki mağaza yarışma katkıları',
  'storeCompetitions.contributionRowsNote':
    'Mevcut okuma kapsamındaki mağaza katkı satırları.',
  'storeCompetitions.warnings': 'Uyarılar',
  'storeCompetitions.scopedWarningsAria': 'Kapsamdaki mağaza yarışma uyarıları',
  'storeCompetitions.warningsNote':
    'Bu oturum kapsamına göre filtrelenen veri kalite uyarıları.',
  'storeCompetitions.teamStanding': 'Takım sıralaması',
  'storeCompetitions.latestScores': 'Son skorlar',
  'storeCompetitions.noTeamSnapshot': 'Henüz takım skoru görünümü yok.',
  'storeCompetitions.score': 'Skor',
  'storeCompetitions.coverage': 'Kapsam',
  'storeCompetitions.teamCode': 'Takım kodu',
  'storeCompetitions.partialScore': 'Kısmi',
} as const

export const storeCompetitionsEn: Record<keyof typeof storeCompetitionsTr, string> = {
  'storeCompetitions.noStoreScope': 'No store scope',
  'storeCompetitions.unavailableTitle': 'Competition surface unavailable',
  'storeCompetitions.unavailableCopy':
    'This store route requires a store manager or store personnel session.',
  'storeCompetitions.loadingTitle': 'Store competitions are loading',
  'storeCompetitions.loadingCopy':
    'The store shell is checking scoped competition standings.',
  'storeCompetitions.errorTitle': 'Competition surface could not load',
  'storeCompetitions.retryAction': 'Try again',
  'storeCompetitions.retryingAction': 'Retrying...',

  'storeCompetitions.heroEyebrow': 'Store competitions',
  'storeCompetitions.title': 'Store competitions and scoped contribution scores.',
  'storeCompetitions.heroCopy':
    'Store users see active competition standings and the contribution rows that belong to their resolved read scope.',
  'storeCompetitions.route': 'Route',
  'storeCompetitions.storeScope': 'Store scope',
  'storeCompetitions.competitions': 'Competitions',
  'storeCompetitions.contributions': 'Contributions',

  'storeCompetitions.competitionList': 'Competition list',
  'storeCompetitions.visibleChallenges': 'Visible challenges',
  'storeCompetitions.readOnly': 'Read only',
  'storeCompetitions.noVisibleTitle': 'No visible competitions',
  'storeCompetitions.noVisibleCopy':
    'Competitions appear here when at least one scoped store participates.',
  'storeCompetitions.review': 'Review',
  'storeCompetitions.type': 'Type',
  'storeCompetitions.state': 'State',
  'storeCompetitions.starts': 'Starts',
  'storeCompetitions.ends': 'Ends',

  'storeCompetitions.standing': 'Standing',
  'storeCompetitions.readSummaryAria': 'Store competition read summary',
  'storeCompetitions.warningCount': '{count} warnings',
  'storeCompetitions.standingLoadingTitle': 'Standing is loading',
  'storeCompetitions.standingLoadingCopy': 'Scoped competition detail is loading.',
  'storeCompetitions.standingErrorTitle': 'Standing could not load',
  'storeCompetitions.teams': 'Teams',
  'storeCompetitions.teamsNote':
    'Current team standing rows visible for this competition.',
  'storeCompetitions.contributionRows': 'Contribution rows',
  'storeCompetitions.scopedContributionsAria': 'Scoped store competition contributions',
  'storeCompetitions.contributionRowsNote':
    'Store contribution rows inside the current read scope.',
  'storeCompetitions.warnings': 'Warnings',
  'storeCompetitions.scopedWarningsAria': 'Scoped store competition warnings',
  'storeCompetitions.warningsNote':
    'Data quality warnings filtered by this session scope.',
  'storeCompetitions.teamStanding': 'Team standing',
  'storeCompetitions.latestScores': 'Latest scores',
  'storeCompetitions.noTeamSnapshot': 'No team score snapshot is available yet.',
  'storeCompetitions.score': 'Score',
  'storeCompetitions.coverage': 'Coverage',
  'storeCompetitions.teamCode': 'Team code',
  'storeCompetitions.partialScore': 'Partial',
}
