import type { ReactElement } from 'react'

/** Stroke icons on a 24-grid, ported from the POC. Presentational; hidden from a11y. */

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export type IconName = 'home' | 'groups' | 'friends' | 'profile' | 'plus'

export function Icon({ name }: { name: IconName }): ReactElement {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden>
          <path d="M4 11l8-7 8 7v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
          <path d="M10 20v-6h4v6" />
        </svg>
      )
    case 'groups':
      return (
        <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden>
          <circle cx="9" cy="8.5" r="3.2" />
          <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
          <path d="M15.5 5.6a3.2 3.2 0 1 1 1.2 6.2" />
          <path d="M17.5 14.6c1.7.5 2.8 1.9 3 4" />
        </svg>
      )
    case 'friends':
      return (
        <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden>
          <path d="M12 21s-7-4.6-7-10a4.2 4.2 0 0 1 7-3.1A4.2 4.2 0 0 1 19 11c0 5.4-7 10-7 10z" />
        </svg>
      )
    case 'profile':
      return (
        <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 20c.8-3.7 3.5-5.6 7-5.6s6.2 1.9 7 5.6" />
        </svg>
      )
    case 'plus':
      return (
        <svg viewBox="0 0 24 24" {...strokeProps} aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
  }
}
