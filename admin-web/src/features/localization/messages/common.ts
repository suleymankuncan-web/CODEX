export const commonTr = {
  'language.groupLabel': 'Dil seçimi',
  'language.switchToTurkish': 'Türkçeye geç',
  'language.switchToEnglish': 'İngilizceye geç',
  'language.turkishShort': 'TR',
  'language.englishShort': 'EN',

  'common.latestMonthlyData': 'Son aylık veri',
  'common.noData': 'Veri yok',
  'common.notRanked': 'Sıralama yok',
  'common.rankFraction': '{rank}/{population}',
  'common.rowCount': '{count} satır',
  'common.personCount': '{count} kişi',
  'common.storePopulation': '{count} mağaza popülasyonu',
  'common.personnelPopulation': '{count} personel popülasyonu',
  'common.retryAction': 'Tekrar dene',
} as const

export const commonEn: Record<keyof typeof commonTr, string> = {
  'language.groupLabel': 'Language selection',
  'language.switchToTurkish': 'Switch language to Turkish',
  'language.switchToEnglish': 'Switch language to English',
  'language.turkishShort': 'TR',
  'language.englishShort': 'EN',

  'common.latestMonthlyData': 'Latest monthly data',
  'common.noData': 'No data',
  'common.notRanked': 'Not ranked',
  'common.rankFraction': '{rank}/{population}',
  'common.rowCount': '{count} rows',
  'common.personCount': '{count} people',
  'common.storePopulation': '{count} store population',
  'common.personnelPopulation': '{count} personnel population',
  'common.retryAction': 'Try again',
}
