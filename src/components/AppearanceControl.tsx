import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { ThemePreference, applyThemePreference, readThemePreference } from '../lib/theme/theme'

/**
 * A segmented System / Light / Dark control for the appearance preference.
 *
 * Appearance is client-only (a cookie + `data-theme`), so the change applies instantly
 * and is never part of a profile save. It renders during SSR too, where the cookie is
 * unreadable — so the initial state is `system` on both server and first client render
 * (a hydration-safe match), then an effect reconciles it to the persisted choice once
 * `document` exists. Only the highlighted segment corrects; the actual theme was
 * already stamped before paint by the root's init script, so nothing flashes.
 */

const OPTIONS = [
  { value: ThemePreference.System, label: 'System' },
  { value: ThemePreference.Light, label: 'Light' },
  { value: ThemePreference.Dark, label: 'Dark' },
] as const

export function AppearanceControl(): ReactElement {
  const [preference, setPreference] = useState<ThemePreference>(ThemePreference.System)

  // Reconcile with the persisted cookie once mounted — reading it during render would
  // both touch `document` (absent under SSR) and risk a hydration mismatch.
  useEffect(() => {
    setPreference(readThemePreference())
  }, [])

  const choose = (next: ThemePreference): void => {
    applyThemePreference(next)
    setPreference(next)
  }

  return (
    <div className="segmented" role="group" aria-label="Appearance">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented-option"
          aria-pressed={preference === option.value}
          onClick={() => choose(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
