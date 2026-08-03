import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'

export type WindowBounds = { x: number; y: number; width: number; height: number }
export type WindowState = WindowBounds & { maximized: boolean }

type DisplayArea = WindowBounds

export function readWindowState(path: string, displays: DisplayArea[]): WindowState | null {
  try {
    const candidate = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!isWindowState(candidate)) return null
    if (!displays.some((display) => intersectsDisplay(candidate, display))) return null
    return candidate
  } catch {
    return null
  }
}

export function writeWindowState(path: string, state: WindowState): void {
  if (!isWindowState(state)) return
  const temporaryPath = `${path}.tmp`
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(state)}\n`, 'utf8')
    renameSync(temporaryPath, path)
  } catch {
    try {
      rmSync(temporaryPath, { force: true })
    } catch {
      // Window-state persistence must never prevent the application from closing.
    }
  }
}

export function isWindowState(candidate: unknown): candidate is WindowState {
  if (!candidate || typeof candidate !== 'object') return false
  const state = candidate as Partial<WindowState>
  return (
    Number.isInteger(state.x) &&
    Number.isInteger(state.y) &&
    Number.isInteger(state.width) &&
    Number.isInteger(state.height) &&
    (state.width ?? 0) >= 960 &&
    (state.width ?? 0) <= 10_000 &&
    (state.height ?? 0) >= 640 &&
    (state.height ?? 0) <= 10_000 &&
    typeof state.maximized === 'boolean'
  )
}

function intersectsDisplay(window: WindowBounds, display: DisplayArea): boolean {
  const visibleWidth =
    Math.min(window.x + window.width, display.x + display.width) - Math.max(window.x, display.x)
  const visibleHeight =
    Math.min(window.y + window.height, display.y + display.height) - Math.max(window.y, display.y)
  return visibleWidth >= 100 && visibleHeight >= 100
}
