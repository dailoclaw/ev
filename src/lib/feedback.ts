// The Sound of Money — a three-word vocabulary for saving a charge.
//
// The app has one visual output channel: pixels. That is a poor fit for the moment it
// is actually used — one hand on a cable, phone half in a pocket, wanting to know one
// thing: did that charge cost me anything?
//
// So a save carries a signature. Three of them, no more, each mapping to a state the
// ledger already computes:
//
//   free     two notes rising    nothing was paid
//   paid     one flat note       money left your account
//   overflow two notes falling   the allowance ran out mid-charge
//
// Sound is the only channel. Vibration was tried and removed: navigator.vibrate has
// never been supported in Safari on iOS, so on this app's actual device it was a
// setting that did nothing at all.
//
// Tones are synthesised, so there are no audio files to ship and nothing to license.
// The preference is device-local — whether a phone should make noise is a property of
// the phone in your hand, not of the account.
import { useSyncExternalStore } from 'react'

export type FeedbackMode = 'off' | 'sound'
export type SaveTone = 'free' | 'paid' | 'overflow'

const KEY = 'ev.feedback'
export const DEFAULT_FEEDBACK: FeedbackMode = 'sound'

const isMode = (value: string | null): value is FeedbackMode => value === 'off' || value === 'sound'

export function getStoredFeedback(): FeedbackMode {
  try {
    const stored = localStorage.getItem(KEY)
    if (isMode(stored)) return stored
    // Migrate the two retired modes. 'haptic' meant "buzz, but stay silent", so the
    // faithful reading of that choice is silence rather than surprise noise.
    if (stored === 'haptic') return 'off'
    if (stored === 'both') return 'sound'
    return DEFAULT_FEEDBACK
  } catch {
    return DEFAULT_FEEDBACK
  }
}

const listeners = new Set<() => void>()

export function setFeedback(mode: FeedbackMode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // A full or blocked store is not worth failing a save over.
  }
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * What kind of charge just landed.
 *
 * `free` means nothing was paid — the outcome worth knowing without looking.
 * `overflow` means the day's allowance ran out partway through this charge, which is
 * the one moment the ledger can flag at the instant it happens.
 */
export function classifySave(input: { isFee: boolean; kwh: number; cost: number; freeKwh: number }): SaveTone {
  const { isFee, kwh, cost, freeKwh } = input
  if (isFee) return 'paid'
  const free = Math.max(0, Math.min(freeKwh, kwh))
  if (cost <= 0) return 'free'
  if (free > 0) return 'overflow'
  return 'paid'
}

/** The notes each signature plays, in Hz. */
const SIGNATURES: Record<SaveTone, number[]> = {
  free: [587.33, 880], // D5 → A5, rising
  paid: [440], // A4, flat
  overflow: [587.33, 415.3], // D5 → G#4, falling
}

export const TONE_COPY: Record<SaveTone, { title: string; detail: string; icon: string; color: string }> = {
  free: { title: 'Entirely free', detail: 'two notes rising', icon: 'tonerise', color: 'var(--money)' },
  paid: { title: 'Paid', detail: 'one flat note', icon: 'toneflat', color: 'var(--steel)' },
  overflow: { title: 'Past the allowance', detail: 'two notes falling', icon: 'tonefall', color: 'var(--warn)' },
}

let ctx: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!ctx) ctx = new Ctor()
    // Autoplay policy suspends the context until a gesture; a save is one.
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

const NOTE_MS = 90
const GAP_MS = 55
const PEAK_GAIN = 0.09

function playNotes(notes: number[]) {
  const audio = audioContext()
  if (!audio) return
  notes.forEach((freq, i) => {
    const start = audio.currentTime + (i * (NOTE_MS + GAP_MS)) / 1000
    const end = start + NOTE_MS / 1000
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, start)
    // A short attack and a decay to near-zero — a square envelope clicks.
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(end + 0.02)
  })
}

/**
 * Play one signature. Never throws and never blocks the caller — a save must land
 * whether or not the phone can make a noise.
 */
export function playSaveFeedback(tone: SaveTone, mode: FeedbackMode = getStoredFeedback()) {
  if (mode === 'off') return
  playNotes(SIGNATURES[tone])
}

/** Play a signature regardless of the stored mode — for the Settings preview. */
export function previewSaveFeedback(tone: SaveTone) {
  playSaveFeedback(tone, 'sound')
}

/** The current mode, re-rendering every subscriber on change. */
export function useFeedback() {
  const mode = useSyncExternalStore(subscribe, getStoredFeedback, () => DEFAULT_FEEDBACK)
  return [mode, setFeedback] as const
}
