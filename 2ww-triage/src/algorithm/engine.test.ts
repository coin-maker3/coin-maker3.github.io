import { describe, it, expect } from 'vitest'
import { decide } from './engine'
import { DEFAULT_INTAKE } from '../schema/intake'

describe('placeholder decision engine', () => {
  it('routes FIT >= 10 to colonoscopy', () => {
    const result = decide({ ...DEFAULT_INTAKE, fit: 25 })
    expect(result.investigation).toBe('colonoscopy')
    expect(result.algorithmNodeId).toBe('PLACEHOLDER.FIT_POS')
    expect(result.path.length).toBeGreaterThanOrEqual(2)
  })

  it('routes FIT < 10 to discharge', () => {
    const result = decide({ ...DEFAULT_INTAKE, fit: 4 })
    expect(result.investigation).toBe('discharge_to_gp')
    expect(result.algorithmNodeId).toBe('PLACEHOLDER.FIT_NEG')
  })

  it('warns and discusses with COW when FIT missing', () => {
    const result = decide({ ...DEFAULT_INTAKE, fit: null })
    expect(result.investigation).toBe('discuss_with_cow')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('stamps every decision with algorithm version and timestamp', () => {
    const result = decide({ ...DEFAULT_INTAKE, fit: 12 })
    expect(result.algorithm.id).toBe('GEH-2WW-COLORECTAL')
    expect(result.algorithm.version).toMatch(/^\d/)
    expect(() => new Date(result.computedAt).toISOString()).not.toThrow()
  })
})
