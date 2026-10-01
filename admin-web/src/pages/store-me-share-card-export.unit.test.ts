import { describe, it, expect, vi } from 'vitest'
import { buildPerformanceCardFile, canSharePerformanceCard } from './store-me-share-card-export'

describe('performance card image output', () => {
  it('supplies an image/png File with a PNG filename to native share targets', async () => {
    const file = buildPerformanceCardFile(new Blob(['png-fixture'], { type: 'image/png' }), 'Fixture Person', '2026-09-01')
    expect(file.type).toBe('image/png')
    expect(file.name).toBe('lufian-performans-karti-fixture-person-2026-09.png')
    expect(await file.text()).toBe('png-fixture')
  })
  it('refuses empty or non-PNG output', () => {
    expect(() => buildPerformanceCardFile(new Blob([],{type:'image/png'}),'Fixture','2026-09')).toThrow()
    expect(() => buildPerformanceCardFile(new Blob(['text'],{type:'text/plain'}),'Fixture','2026-09')).toThrow()
  })
  it('checks native support for the exact image file', () => {
    const file = buildPerformanceCardFile(new Blob(['png'],{type:'image/png'}),'Fixture','2026-09')
    const canShare = vi.fn(() => true)
    vi.stubGlobal('navigator', { share: vi.fn(), canShare })
    expect(canSharePerformanceCard(file)).toBe(true)
    expect(canShare).toHaveBeenCalledWith({ files: [file] })
    vi.stubGlobal('navigator', {})
    expect(canSharePerformanceCard(file)).toBe(false)
    vi.unstubAllGlobals()
  })
})
