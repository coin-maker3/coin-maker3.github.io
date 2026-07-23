import { describe, expect, it } from 'vitest'
import { ageToBand } from './intake'

describe('ageToBand', () => {
  it('maps boundaries correctly per Trust algorithm cutoffs', () => {
    // The engine has hard cutoffs at ≥80 and ≥90 — the bands MUST honour them.
    expect(ageToBand(0)).toBe('<40')
    expect(ageToBand(39)).toBe('<40')
    expect(ageToBand(40)).toBe('40-49')
    expect(ageToBand(49)).toBe('40-49')
    expect(ageToBand(50)).toBe('50-59')
    expect(ageToBand(59)).toBe('50-59')
    expect(ageToBand(60)).toBe('60-69')
    expect(ageToBand(67)).toBe('60-69')
    expect(ageToBand(69)).toBe('60-69')
    expect(ageToBand(70)).toBe('70-79')
    expect(ageToBand(79)).toBe('70-79')
    expect(ageToBand(80)).toBe('80-89') // critical: ≥80 triggers CTC/CT branches
    expect(ageToBand(89)).toBe('80-89')
    expect(ageToBand(90)).toBe('>=90') // critical: ≥90 triggers CT-TAP / CT-AP
    expect(ageToBand(105)).toBe('>=90')
  })

  it('handles negatives and out-of-range deterministically', () => {
    expect(ageToBand(-5)).toBe('<40')
    expect(ageToBand(200)).toBe('>=90')
  })

  it('defaults to 60-69 for non-finite input', () => {
    expect(ageToBand(NaN)).toBe('60-69')
  })
})
