export const competitionAdminUxTr = {
  'competition.admin.decisionBriefTitle': 'Karar özeti',
  'competition.admin.decisionBriefCopy': '{competition} için mevcut durum {status}. Aksiyonlar bu görünür etap verisine göre değerlendirilir.',
  'competition.admin.selectedCompetition': 'Seçili yarışma',
  'competition.admin.activeStage': 'Aktif etap',
  'competition.admin.operatorMode': 'Operatör modu',
  'competition.admin.noActiveStage': 'Etap yok',
} as const

export const competitionAdminUxEn: Record<keyof typeof competitionAdminUxTr, string> = {
  'competition.admin.decisionBriefTitle': 'Decision brief',
  'competition.admin.decisionBriefCopy': '{competition} is currently {status}. Actions are evaluated against this visible stage data.',
  'competition.admin.selectedCompetition': 'Selected competition',
  'competition.admin.activeStage': 'Active stage',
  'competition.admin.operatorMode': 'Operator mode',
  'competition.admin.noActiveStage': 'No stage',
}
