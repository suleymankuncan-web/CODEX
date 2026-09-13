import { describe, expect, it } from 'vitest'
import { notificationErrorMessage, translatedNotificationMessage } from './notification-messages'

describe('Turkish notifications', () => {
  it('explains a pending personnel correction in Turkish', () => {
    expect(notificationErrorMessage(new Error('Personnel already has a pending correction'), 'Talep gönderilemedi.')).toContain('İK onayı bekleyen bir düzeltme talebi var')
  })
  it.each(['unrecognized server rejection', 'proposed.nationalId must match /^[0-9]{11}$/ regular expression', 'SQL error'])('uses the Turkish fallback for %s', message => {
    expect(notificationErrorMessage(new Error(message), 'Talep gönderilemedi.')).toBe('Talep gönderilemedi.')
  })
  it('translates server success messages', () => {
    expect(translatedNotificationMessage('Seller code request approved')).toBe('Personel sicil talebi onaylandı.')
    expect(translatedNotificationMessage('Checklist visit started.')).toBe('Checklist ziyareti başlatıldı.')
  })
})
