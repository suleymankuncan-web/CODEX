import type { AccountSecurity } from './account-security-api'

export function accountTimestamp(value: string | null | undefined, english: boolean) {
  if (!value || !Number.isFinite(Date.parse(value))) return english ? 'No record yet' : 'Henüz kayıt yok'
  return new Intl.DateTimeFormat(english ? 'en-GB' : 'tr-TR', {
    timeZone: 'Europe/Istanbul', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))
}

export function linkState(state: AccountSecurity['requests'][number]['state'], english: boolean) {
  const states = { queued: ['Kuyrukta', 'Queued'], sending: ['Gönderiliyor', 'Sending'], sent: ['Bağlantı gönderildi', 'Link sent'],
    failed: ['Gönderilemedi', 'Failed'], unconfirmed: ['Gönderim doğrulanamadı', 'Send unconfirmed'],
    completed: ['Şifre değişimi doğrulandı', 'Password change verified'], expired: ['Takip süresi doldu', 'Tracking expired'] }
  return states[state][english ? 1 : 0]
}
