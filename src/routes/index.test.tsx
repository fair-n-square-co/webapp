import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Home } from './index'

// Smoke test proving the RTL harness works and querying by accessible role (§9).
describe('Home', () => {
  it('renders the app heading', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { level: 1, name: /fair.*square/i })).toBeInTheDocument()
  })
})
