import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FEEDBACK,
  classifySave,
  getStoredFeedback,
  playSaveFeedback,
  setFeedback,
} from './feedback'

// Tests run in node, so the browser globals the module guards against are absent.
// Stub localStorage; there is deliberately no AudioContext here, which the last case
// relies on to prove a save still lands on a device that cannot make a sound.
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
})

beforeEach(() => {
  store.clear()
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
  it('offers sound or nothing — vibration is gone, iOS Safari never supported it', () => {
    expect(DEFAULT_FEEDBACK).toBe('sound')
    expect(getStoredFeedback()).toBe('sound')
  })

  it('round-trips a stored choice', () => {
    setFeedback('off')
    expect(getStoredFeedback()).toBe('off')
    setFeedback('sound')
    expect(getStoredFeedback()).toBe('sound')
  })

  it('reads a retired "haptic" choice as off, since it meant stay silent', () => {
    store.set('ev.feedback', 'haptic')
    expect(getStoredFeedback()).toBe('off')
  })

  it('reads a retired "both" choice as sound', () => {
    store.set('ev.feedback', 'both')
    expect(getStoredFeedback()).toBe('sound')
  })

  it('falls back to the default when the stored value is junk', () => {
    store.set('ev.feedback', 'trumpet')
    expect(getStoredFeedback()).toBe(DEFAULT_FEEDBACK)
  })
})

describe('playSaveFeedback', () => {
  it('never throws when the device has no audio support', () => {
    // No AudioContext exists in this environment at all.
    expect(() => playSaveFeedback('overflow', 'sound')).not.toThrow()
    expect(() => playSaveFeedback('free', 'off')).not.toThrow()
  })

  it('reads the stored preference when no mode is passed', () => {
    setFeedback('off')
    expect(() => playSaveFeedback('free')).not.toThrow()
    setFeedback('sound')
    expect(() => playSaveFeedback('free')).not.toThrow()
  })
})
