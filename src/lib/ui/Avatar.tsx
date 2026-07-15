import type { CSSProperties } from 'react'
import { hueFromString, initials } from '../util'

type AvatarSize = 'sm' | 'md' | 'lg'

type AvatarProps = {
  /** Name the initials and tooltip come from. May be empty. */
  name: string
  /** Stable string (e.g. the user id) the colour is derived from. */
  colorSeed: string
  size?: AvatarSize
}

// `--av-h` feeds the oklch() lightness/chroma in styles.css. It is a CSS custom
// property, which React's CSSProperties type doesn't know about, so widen locally.
type AvatarStyle = CSSProperties & { '--av-h': number }

/**
 * A circular, monogram avatar. Colour is derived deterministically from `colorSeed`
 * so a given user is always the same hue, and the initials come from `name` (falling
 * back to `?` when it is empty). Presentational only — no data or route coupling.
 */
export function Avatar({ name, colorSeed, size = 'md' }: AvatarProps) {
  const className = size === 'md' ? 'avatar' : `avatar ${size}`
  const style: AvatarStyle = { '--av-h': hueFromString(colorSeed) }
  const label = name.trim() === '' ? undefined : name

  return (
    <span className={className} style={style} title={label} aria-hidden>
      {initials(name)}
    </span>
  )
}
