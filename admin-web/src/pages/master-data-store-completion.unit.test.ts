import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateStoreContactEmails } from './master-data-store-transition'

const managementSource = readFileSync(join(process.cwd(), 'src/pages/MasterDataManagementPage.tsx'), 'utf8')
const controlCenterSource = readFileSync(join(process.cwd(), 'src/pages/master-data-control-center-detail.tsx'), 'utf8')

describe('store master completion surfaces', () => {
  it('shows KPI scope and repeatable contact emails in the normal editor', () => {
    expect(managementSource).toContain('KPI aktarımına dahil')
    expect(managementSource).toContain('Mağaza e-posta adresleri')
    expect(managementSource).toContain('E-posta ekle')
    expect(managementSource).toContain('Kaynak eşleşti')
  })

  it('keeps the control-center editor on the same contact and KPI contract', () => {
    expect(controlCenterSource).toContain('KPI aktarımına dahil')
    expect(controlCenterSource).toContain('Mağaza e-posta adresleri')
    expect(controlCenterSource).toContain('contactEmails')
  })

  it('enforces count, normalized uniqueness, syntax and one primary address', () => {
    expect(validateStoreContactEmails([
      { emailAddress: 'Store@Example.com', isPrimary: true },
      { emailAddress: 'store@example.com', isPrimary: false },
    ])).toMatch(/birden fazla/)
    expect(validateStoreContactEmails([{ emailAddress: 'invalid', isPrimary: true }])).toMatch(/Geçerli/)
    expect(validateStoreContactEmails([{ emailAddress: 'store@example.com', isPrimary: false }])).toMatch(/birincil/)
    expect(validateStoreContactEmails(Array.from({ length: 11 }, (_, index) => ({
      emailAddress: `store${index}@example.com`, isPrimary: index === 0,
    })))).toMatch(/en fazla 10/)
    expect(validateStoreContactEmails([{ emailAddress: 'store@example.com', label: 'x'.repeat(81), isPrimary: true }])).toMatch(/80/)
  })
})
