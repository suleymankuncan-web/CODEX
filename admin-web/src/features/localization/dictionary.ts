import { defaultAppLocale, type AppLocale } from '../../lib/i18n'

const tr = {
  'language.groupLabel': 'Dil seçimi',
  'language.switchToTurkish': 'Türkçeye geç',
  'language.switchToEnglish': 'İngilizceye geç',
  'language.turkishShort': 'TR',
  'language.englishShort': 'EN',

  'competition.readScope': 'Okuma Kapsamı',
  'competition.readSummary': 'Okuma özeti',
  'competition.bestVisibleRank': 'En iyi görünen sıra',
  'competition.teamCoverage': 'Takım kapsamı',
  'competition.contributionCoverage': 'Katkı kapsamı',
  'competition.contributionHealth': 'Katkı sağlığı',
  'competition.scopedContributions': 'Kapsamdaki katkılar',
  'competition.scopedWarnings': 'Kapsamdaki uyarılar',
  'competition.dataQuality': 'Veri Kalitesi',
  'competition.snapshot': 'Snapshot',
  'competition.coverage': 'Kapsam',
  'competition.missingKpis': 'Eksik KPIlar',
  'competition.whyItMatters': 'Neden önemli',
  'competition.warningCode': 'Uyarı kodu',
  'competition.periodStart': 'Periyot başlangıcı',
  'competition.periodEnd': 'Periyot bitişi',
  'competition.store': 'Mağaza',
  'competition.team': 'Takım',
  'competition.teamLevel': 'Takım seviyesi',
  'competition.noScopedContributionRowsTitle': 'Kapsamda katkı satırı yok',
  'competition.noScopedContributionRowsCopy':
    'Bu oturum yarışmayı görebiliyor, ancak okuma kapsamında mağaza katkı snapshotı yok.',
  'competition.noScopedStoreContributionRowsCopy':
    'Bu seçim için kapsamda mağaza katkı satırı bulunmuyor.',
  'competition.noOpenWarnings': 'Açık uyarı yok',
  'competition.noScopedWarningsCopy': 'Kapsamda açık veri kalitesi uyarısı yok.',
  'competition.stageDataCleanCopy': 'Stage veri kalitesi temiz.',
  'competition.rowsSuffix': 'satır',
  'competition.clean': 'Temiz',

  'competition.read.noRankedTeam': 'Henüz sıralanan takım yok',
  'competition.read.noTeamCoverage': 'Takım kapsamı yok',
  'competition.read.teamCoverageSuffix': 'takım kapsamı',
  'competition.read.noContributionRows': 'Katkı satırı yok',
  'competition.read.contributionCoverageSuffix': 'katkı kapsamı',
  'competition.read.attentionItemsSuffix': 'dikkat maddesi',
  'competition.read.cleanRead': 'Temiz okuma',
  'competition.read.reviewBeforeFinal':
    'Bu sıralamayı final kabul etmeden önce uyarı ve kısmi satırları incele.',
  'competition.read.completeContributionCoverage': 'Görünen skorların katkı kapsamı tamam.',

  'competition.contribution.missingDailyData': 'Günlük veri eksik',
  'competition.contribution.partial': 'Kısmi katkı',
  'competition.contribution.complete': 'Tam katkı',
  'competition.contribution.dailyData': 'Günlük veri',
  'competition.contribution.someExpectedInputs': 'Beklenen bazı girdiler',
  'competition.contribution.none': 'Yok',
  'competition.contribution.partialDailyExplanation':
    'Bu snapshot için günlük mağaza verisi eksik; skor kısmi kalır.',
  'competition.contribution.partialUntilInputs':
    'Beklenen tüm girdiler gelene kadar skor kısmi.',
  'competition.contribution.completeExplanation':
    'Bu snapshot için tüm beklenen girdiler mevcut.',

  'competition.warning.missingDailyStoreData': 'Günlük mağaza verisi eksik',
  'competition.warning.missingBmChecklist': 'BM checklist eksik',
  'competition.warning.missingVmChecklist': 'VM checklist eksik',
  'competition.warning.missingDailyStoreDataExplanation':
    'Bu periyot için günlük mağaza verisi eksik; skorlar kısmi kalabilir.',
  'competition.warning.missingBmChecklistExplanation':
    'Bu periyot için BM checklist eksik; finalden önce incelenmeli.',
  'competition.warning.missingVmChecklistExplanation':
    'Bu periyot için VM checklist eksik; finalden önce incelenmeli.',

  'competition.kpi.bmChecklist': 'BM checklist',
  'competition.kpi.vmChecklist': 'VM checklist',
  'competition.kpi.targetAchievement': 'Hedef gerçekleşme',
  'competition.kpi.atv': 'ATV',
  'competition.kpi.upt': 'UPT',
  'competition.kpi.cr': 'CR',
} as const

export type TranslationKey = keyof typeof tr

const en: Record<TranslationKey, string> = {
  'language.groupLabel': 'Language selection',
  'language.switchToTurkish': 'Switch language to Turkish',
  'language.switchToEnglish': 'Switch language to English',
  'language.turkishShort': 'TR',
  'language.englishShort': 'EN',

  'competition.readScope': 'Read Scope',
  'competition.readSummary': 'Read summary',
  'competition.bestVisibleRank': 'Best visible rank',
  'competition.teamCoverage': 'Team coverage',
  'competition.contributionCoverage': 'Contribution coverage',
  'competition.contributionHealth': 'Contribution health',
  'competition.scopedContributions': 'Scoped contributions',
  'competition.scopedWarnings': 'Scoped warnings',
  'competition.dataQuality': 'Data Quality',
  'competition.snapshot': 'Snapshot',
  'competition.coverage': 'Coverage',
  'competition.missingKpis': 'Missing KPIs',
  'competition.whyItMatters': 'Why it matters',
  'competition.warningCode': 'Warning code',
  'competition.periodStart': 'Period start',
  'competition.periodEnd': 'Period end',
  'competition.store': 'Store',
  'competition.team': 'Team',
  'competition.teamLevel': 'Team level',
  'competition.noScopedContributionRowsTitle': 'No scoped contribution rows',
  'competition.noScopedContributionRowsCopy':
    'This session can see the competition, but no store contribution snapshot is available inside its read scope.',
  'competition.noScopedStoreContributionRowsCopy':
    'No scoped store contribution rows are available for this selection.',
  'competition.noOpenWarnings': 'No open warnings',
  'competition.noScopedWarningsCopy': 'No scoped data quality warnings are open.',
  'competition.stageDataCleanCopy': 'Stage data quality is clean.',
  'competition.rowsSuffix': 'rows',
  'competition.clean': 'Clean',

  'competition.read.noRankedTeam': 'No ranked team yet',
  'competition.read.noTeamCoverage': 'No team coverage',
  'competition.read.teamCoverageSuffix': 'team coverage',
  'competition.read.noContributionRows': 'No contribution rows',
  'competition.read.contributionCoverageSuffix': 'contribution coverage',
  'competition.read.attentionItemsSuffix': 'attention items',
  'competition.read.cleanRead': 'Clean read',
  'competition.read.reviewBeforeFinal':
    'Review warning and partial rows before treating this standing as final.',
  'competition.read.completeContributionCoverage':
    'Visible scores have complete contribution coverage.',

  'competition.contribution.missingDailyData': 'Missing daily data',
  'competition.contribution.partial': 'Partial contribution',
  'competition.contribution.complete': 'Complete contribution',
  'competition.contribution.dailyData': 'Daily data',
  'competition.contribution.someExpectedInputs': 'Some expected inputs',
  'competition.contribution.none': 'None',
  'competition.contribution.partialDailyExplanation':
    'Daily store data is missing for this snapshot; score remains partial.',
  'competition.contribution.partialUntilInputs':
    'Score is partial until every expected input is reported.',
  'competition.contribution.completeExplanation':
    'All expected inputs are present for this snapshot.',

  'competition.warning.missingDailyStoreData': 'Missing daily store data',
  'competition.warning.missingBmChecklist': 'Missing BM checklist',
  'competition.warning.missingVmChecklist': 'Missing VM checklist',
  'competition.warning.missingDailyStoreDataExplanation':
    'Daily store data is missing for this period; scores may stay partial.',
  'competition.warning.missingBmChecklistExplanation':
    'BM checklist is missing for this period; review before finalizing.',
  'competition.warning.missingVmChecklistExplanation':
    'VM checklist is missing for this period; review before finalizing.',

  'competition.kpi.bmChecklist': 'BM checklist',
  'competition.kpi.vmChecklist': 'VM checklist',
  'competition.kpi.targetAchievement': 'Target achievement',
  'competition.kpi.atv': 'ATV',
  'competition.kpi.upt': 'UPT',
  'competition.kpi.cr': 'CR',
}

const dictionary: Record<AppLocale, Record<TranslationKey, string>> = { tr, en }

export function translate(locale: AppLocale, key: TranslationKey) {
  return dictionary[locale]?.[key] ?? dictionary[defaultAppLocale][key]
}
