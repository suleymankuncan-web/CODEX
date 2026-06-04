export const storeKpisCommandTr = {
  'storeKpis.refreshData': 'Veriyi yenile',
  'storeKpis.commandManagerEyebrow': 'Mağaza müdürü',
  'storeKpis.commandWorkspaceTitle': '{store} KPI çalışma alanı',
  'storeKpis.commandWorkspaceCopy':
    'Mağaza müdürü kendi mağaza skorunu ve mağazadaki personel KPI performansını sekme içinde yönetir.',
  'storeKpis.commandOwnStoreScope': 'Kendi mağaza kapsamı',
  'storeKpis.commandStoreKpiCount': '{count} mağaza KPI',
  'storeKpis.commandPersonnelBadge': '{count} personel',
  'storeKpis.commandStoreTab': 'Mağaza KPI',
  'storeKpis.commandPeopleTab': 'Personel KPI',
  'storeKpis.commandScoreLegend': 'Mağaza skor katkı renkleri',
  'storeKpis.commandScoreLegendHint': "Renk üzerine gelerek KPI'nın skor katkısını gör.",
  'storeKpis.commandNotDone': 'Yapılmadı',
  'storeKpis.commandPassive': 'Pasif',
  'storeKpis.commandChecklistPassiveCopy':
    'Yapılmadığında skor mevcut KPI ağırlıklarından hesaplanır.',
  'storeKpis.commandTargetProgress': 'Hedefin %{value} kadarı gerçekleşti.',
  'storeKpis.commandContributionTitle': 'Mağaza KPI katkı kırılımı',
  'storeKpis.commandContributionCopy':
    "Mağaza KPI'ları KPI config ağırlığı ve referansla birlikte okunur.",
  'storeKpis.commandToneGood': 'İyi / hedef üstü',
  'storeKpis.commandToneWarn': 'Takip gerekli',
  'storeKpis.commandToneProblem': 'Problem / yapılmadı',
  'storeKpis.commandRatio': 'Oran',
  'storeKpis.commandTrendTitle': 'Aylık mağaza skor trendi',
  'storeKpis.commandTrendCopy':
    'Yıl içindeki yüklü aylık dönemler gerçek skor verisiyle görünür.',
  'storeKpis.commandTrendEmptyTitle': 'Aylık skor geçmişi yok',
  'storeKpis.commandTrendEmptyCopy':
    'Bu mağaza için yüklü aylık dönem bulunmadığında grafik boş kalır.',
  'storeKpis.personnelKpiUnavailableCopy':
    'Personel KPI listesi bu oturumda okunamıyor.',
  'storeKpis.commandPeopleCopy':
    'Personel skorları aynı mağaza kapsamındaki gerçek ranking verisinden okunur.',
  'storeKpis.commandPeopleCount': '{count} kişi',
  'storeKpis.personnelKpiEmptyTitle': 'Personel KPI verisi yok',
  'storeKpis.personnelKpiEmptyCopy':
    'Bu mağaza için personel ranking verisi dönmediğinde liste boş kalır.',
  'storeKpis.commandStrong': 'Güçlü',
  'storeKpis.commandWatch': 'Takipte',
  'storeKpis.commandBehind': 'Geride',
  'storeKpis.commandProfile': 'Profil',
  'storeKpis.commandScoreSourceTitle': 'Skor kaynağı',
  'storeKpis.commandScoreSourceCopy':
    'Mağaza skorunun hangi katkı alanlarından beslendiği görülür.',
  'storeKpis.commandPersonnelImpact': 'Personel KPI etkisi',
  'storeKpis.commandPassiveRedistribution':
    '{value} yapılmadığında pay mevcut mağaza KPI ağırlıklarında kalır.',
} as const

export const storeKpisCommandEn: Record<keyof typeof storeKpisCommandTr, string> = {
  'storeKpis.refreshData': 'Refresh data',
  'storeKpis.commandManagerEyebrow': 'Store manager',
  'storeKpis.commandWorkspaceTitle': '{store} KPI workspace',
  'storeKpis.commandWorkspaceCopy':
    'The store manager reads store score and personnel KPI performance inside one tabbed workspace.',
  'storeKpis.commandOwnStoreScope': 'Own store scope',
  'storeKpis.commandStoreKpiCount': '{count} store KPIs',
  'storeKpis.commandPersonnelBadge': '{count} personnel',
  'storeKpis.commandStoreTab': 'Store KPI',
  'storeKpis.commandPeopleTab': 'Personnel KPI',
  'storeKpis.commandScoreLegend': 'Store score contribution colors',
  'storeKpis.commandScoreLegendHint': "Hover a color to see the KPI's score contribution.",
  'storeKpis.commandNotDone': 'Not done',
  'storeKpis.commandPassive': 'Passive',
  'storeKpis.commandChecklistPassiveCopy':
    'When not done, score is calculated from the active KPI weights.',
  'storeKpis.commandTargetProgress': '{value}% of the target is achieved.',
  'storeKpis.commandContributionTitle': 'Store KPI contribution breakdown',
  'storeKpis.commandContributionCopy':
    'Store KPIs are read together with KPI config weight and reference.',
  'storeKpis.commandToneGood': 'Good / above target',
  'storeKpis.commandToneWarn': 'Needs follow-up',
  'storeKpis.commandToneProblem': 'Problem / not done',
  'storeKpis.commandRatio': 'Ratio',
  'storeKpis.commandTrendTitle': 'Monthly store score trend',
  'storeKpis.commandTrendCopy':
    'Loaded monthly periods in the year appear with real score data.',
  'storeKpis.commandTrendEmptyTitle': 'No monthly score history',
  'storeKpis.commandTrendEmptyCopy':
    'The chart stays empty when no loaded monthly period exists for this store.',
  'storeKpis.personnelKpiUnavailableCopy':
    'Personnel KPI list cannot be read in this session.',
  'storeKpis.commandPeopleCopy':
    'Personnel scores are read from real ranking data in the same store scope.',
  'storeKpis.commandPeopleCount': '{count} people',
  'storeKpis.personnelKpiEmptyTitle': 'No personnel KPI data',
  'storeKpis.personnelKpiEmptyCopy':
    'The list stays empty when personnel ranking data is not returned for this store.',
  'storeKpis.commandStrong': 'Strong',
  'storeKpis.commandWatch': 'Watch',
  'storeKpis.commandBehind': 'Behind',
  'storeKpis.commandProfile': 'Profile',
  'storeKpis.commandScoreSourceTitle': 'Score source',
  'storeKpis.commandScoreSourceCopy':
    'Shows which contribution areas feed the store score.',
  'storeKpis.commandPersonnelImpact': 'Personnel KPI impact',
  'storeKpis.commandPassiveRedistribution':
    'When {value} is not done, its share stays inside active store KPI weights.',
}
