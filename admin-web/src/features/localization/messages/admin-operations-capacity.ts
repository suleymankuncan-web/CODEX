export const adminOperationsCapacityTr = {
  'operations.capacity.title': 'Pilot kapasite kararı',
  'operations.capacity.description':
    'Public sağlık koşusu ve korumalı rol kapasite kanıtı ayrı tutulur; bu panel geniş lansman onayı üretmez.',
  'operations.capacity.source': 'Kaynak: {path}',
  'operations.capacity.lastVerified': 'Son doğrulama: {date}',
  'operations.capacity.staleOnOrAfter': 'Bu tarihten itibaren eski kanıt: {date}',
  'operations.capacity.publicBaseline.label': 'Public staging baseline',
  'operations.capacity.publicBaseline.summary': 'Public sağlık endpointleri concurrency 25 seviyesine kadar temiz geçti.',
  'operations.capacity.publicBaseline.nextAction':
    'Korumalı rol koşusu tamamlanana kadar bu sonuç sadece sınırlı pilot güveni sağlar.',
  'operations.capacity.protectedBaseline.label': 'Protected role baseline',
  'operations.capacity.protectedBaseline.summary':
    'Store manager, bölge müdürü ve admin protected route kapasitesi henüz kanıtlanmadı.',
  'operations.capacity.protectedBaseline.nextAction':
    'Taze persona oturumları hazır olduğunda protected read ladder concurrency 25 seviyesine kadar çalıştırılmalı.',
  'operations.capacity.status.passed': 'Geçti',
  'operations.capacity.status.blocked': 'Bloklu',
  'operations.capacity.status.stale': 'Eski kanıt',
  'operations.capacity.decision.pilot_allowed_with_limits':
    'Kontrollü pilot sınırlı eşzamanlılık varsayımıyla devam edebilir.',
  'operations.capacity.decision.pilot_refresh_required':
    'Kontrollü pilot kararı için public kapasite kanıtı yenilenmelidir.',
  'operations.capacity.decision.broad_launch_blocked':
    'Geniş lansman, protected role kapasite kanıtı temiz geçmeden bloklu kalır.',
} as const

export const adminOperationsCapacityEn: Record<keyof typeof adminOperationsCapacityTr, string> = {
  'operations.capacity.title': 'Pilot capacity decision',
  'operations.capacity.description':
    'Public health runs and protected-role capacity evidence stay separate; this panel does not approve broad launch.',
  'operations.capacity.source': 'Source: {path}',
  'operations.capacity.lastVerified': 'Last verified: {date}',
  'operations.capacity.staleOnOrAfter': 'Stale on or after: {date}',
  'operations.capacity.publicBaseline.label': 'Public staging baseline',
  'operations.capacity.publicBaseline.summary': 'Public health endpoints passed cleanly through concurrency 25.',
  'operations.capacity.publicBaseline.nextAction':
    'Until the protected-role run is complete, this result supports only limited pilot confidence.',
  'operations.capacity.protectedBaseline.label': 'Protected role baseline',
  'operations.capacity.protectedBaseline.summary':
    'Store manager, region manager, and admin protected-route capacity is not proven yet.',
  'operations.capacity.protectedBaseline.nextAction':
    'Run the protected read ladder through concurrency 25 after fresh persona sessions are ready.',
  'operations.capacity.status.passed': 'Passed',
  'operations.capacity.status.blocked': 'Blocked',
  'operations.capacity.status.stale': 'Stale',
  'operations.capacity.decision.pilot_allowed_with_limits':
    'Controlled pilot can continue only under limited concurrency assumptions.',
  'operations.capacity.decision.pilot_refresh_required':
    'Refresh public capacity evidence before using it for the controlled pilot decision.',
  'operations.capacity.decision.broad_launch_blocked':
    'Broad launch remains blocked until protected-role capacity evidence passes cleanly.',
}
