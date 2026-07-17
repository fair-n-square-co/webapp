import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SignInFailed } from './SignInFailed'

describe('SignInFailed', () => {
  it('explains the failure and offers a fresh login', () => {
    render(<SignInFailed />)

    expect(
      screen.getByRole('heading', { level: 1, name: /couldn’t finish signing you in/i }),
    ).toBeInTheDocument()

    const retry = screen.getByRole('link', { name: 'Try signing in again' })
    // A full-page navigation to the server-only login route, not a client <Link>.
    expect(retry).toHaveAttribute('href', '/auth/login')
  })
})
