import { describe, expect, it } from 'vitest'
import { isWindowState } from './window-state'

describe('window state validation', () => {
  it('accepts a normal application window', () => {
    expect(isWindowState({ x: 30, y: 40, width: 1280, height: 820, maximized: false })).toBe(true)
  })

  it('accepts coordinates on a monitor to the left', () => {
    expect(isWindowState({ x: -1200, y: 20, width: 1100, height: 700, maximized: true })).toBe(true)
  })

  it('rejects undersized or malformed values', () => {
    expect(isWindowState({ x: 0, y: 0, width: 700, height: 500, maximized: false })).toBe(false)
    expect(isWindowState({ x: 0, y: 0, width: 1280, height: 820 })).toBe(false)
  })
})
