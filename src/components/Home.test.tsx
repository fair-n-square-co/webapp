import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Home } from './Home'

describe('Home', () => {
  it('renders the app name as the page heading', () => {
    render(<Home />)

    expect(screen.getByRole('heading', { level: 1, name: /fair.*square/i })).toBeInTheDocument()
  })
})
