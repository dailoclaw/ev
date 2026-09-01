import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FEEDBACK,
  classifySave,
  getStoredFeedback,
  playSaveFeedback,
  setFeedback,
} from './feedback'

// Tests run in node, so the browser globals the module guards against are absent.
// Stub the two it touches; the module already survives their absence, which the
// last case here checks explicitly.
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
})

const vibrations: number[][] = []
vi.stubGlobal('navigator', { vibrate: (pattern: number[]) => void vibrations.push(pattern) })

beforeEach(() => {
  store.clear()
  vibrations.length = 0
})

describe('classifySave', () => {
  it('calls a charge that cost nothing free', () => {
    expect(classifySave({ isFee: false, kwh: 6.2, cost: 0, freeKwh: 6.2 })).toBe('free')
  })

  it('calls a fully billed charge paid', () => {
    expect(classifySave({ isFee: false, kwh: 31.2, cost: 21.84, freeKwh: 0 })).toBe('paid')
  })

  it('calls a charge that ran past the allowance overflow', () => {
    expect(classifySave({ isFee: false, kwh: 9.6, cost: 1.09, freeKwh: 7 })).toBe('overflow')
  })

  it('treats a membership fee as paid, not as an overflow', () => {
    expect(classifySave({ isFee: true, kwh: 0, cost: 15, freeKwh: 0 })).toBe('paid')
  })

  it('treats a free charge at a network with no allowance as free', () => {
    expect(classifySave({ isFee: false, kwh: 4, cost: 0, freeKwh: 0 })).toBe('free')
  })

  it('ignores a free allocation larger than the charge itself', () => {
    // The allowance had 7 kWh left but only 2 kWh was taken: still entirely free.
    expect(classifySave({ isFee: false, kwh: 2, cost: 0, freeKwh: 7 })).toBe('free')
  })

  it('does not treat a negative free figure as overflow', () => {
    expect(classifySave({ isFee: false, kwh: 5, cost: 3.2, freeKwh: -1 })).toBe('paid')
  })
})

describe('feedback preference', () => {
  it('defaults to haptics only, so nothing makes noise unasked', () => {
    expect(DEFAULT_FEEDBACK).toBe('haptic')
    expect(getStoredFeedback()).toBe('haptic')
  })

  it('round-trips a stored choice', () => {
    setFeedback('both')
    expect(getStoredFeedback()).toBe('both')
    setFeedback('off')
    expect(getStoredFeedback()).toBe('off')
  })

  it('falls back to the default when the stored value is junk', () => {
    store.set('ev.feedback', 'trumpet')
    expect(getStoredFeedback()).toBe(DEFAULT_FEEDBACK)
  })
})

describe('playSaveFeedback', () => {
  it('stays silent and still when switched off', () => {
    playSaveFeedback('free', 'off')
    expect(vibrations).toHaveLength(0)
  })

  it('gives each tone a pattern a hand can tell apart', () => {
    playSaveFeedback('free', 'haptic')
    playSaveFeedback('paid', 'haptic')
    playSaveFeedback('overflow', 'haptic')
    expect(vibrations).toHaveLength(3)
    expect(new Set(vibrations.map(pattern => pattern.join(',')))).toHaveLength(3)
    // Overflow is the doubled one — the only pattern with a gap in it.
    expect(vibrations[2].length).toBeGreaterThan(1)
  })

  it('reads the stored preference when no mode is passed', () => {
    setFeedback('off')
    playSaveFeedback('free')
    expect(vibrations).toHaveLength(0)
    setFeedback('haptic')
    playSaveFeedback('free')
    expect(vibrations).toHaveLength(1)
  })

  it('never throws when the device cannot vibrate or make sound', () => {
    vi.stubGlobal('navigator', {})
    expect(() => playSaveFeedback('overflow', 'both')).not.toThrow()
    vi.stubGlobal('navigator', { vibrate: (pattern: number[]) => void vibrations.push(pattern) })
  })
})
