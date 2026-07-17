import type { ReactNode } from 'react'
import { Avatar } from '../lib/ui/Avatar'

type IdentityCardProps = Readonly<{
  /** Display name. May be empty — `placeholder` stands in, and the avatar falls back to the email. */
  name: string
  /** What the heading shows when `name` is empty (e.g. "Signed in", "Unnamed"). */
  placeholder: string
  email: string
  /** Stable string the avatar colour derives from (the user id, or the email failing that). */
  colorSeed: string
  /** Optional trailing action, e.g. a log-out button. */
  children?: ReactNode
}>

/**
 * The avatar + name + email card used wherever a user identity headlines a screen
 * (home, profile). Purely presentational — callers own where the identity comes from.
 */
export function IdentityCard({ name, placeholder, email, colorSeed, children }: IdentityCardProps) {
  return (
    <div className="card identity">
      <Avatar name={name || email} colorSeed={colorSeed} size="lg" />
      <div className="who">
        <h2 className="name">{name || placeholder}</h2>
        <div className="email">{email}</div>
      </div>
      {children}
    </div>
  )
}
