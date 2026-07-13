import { describe, expect, it } from 'vitest'
import { createOAuthState, isSameOAuthState } from './oauth-state'

describe('createOAuthState', () => {
  it('generates a URL-safe value', () => {
    expect(createOAuthState()).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('generates a different value on each call', () => {
    const states = new Set(Array.from({ length: 50 }, () => createOAuthState()))
    expect(states.size).toBe(50)
  })
})

describe('isSameOAuthState', () => {
  it('accepts a value that matches the one issued at login', () => {
    const state = createOAuthState()
    expect(isSameOAuthState(state, state)).toBe(true)
  })

  it('rejects a value that does not match', () => {
    expect(isSameOAuthState(createOAuthState(), createOAuthState())).toBe(false)
  })

  it('rejects a value of a different length instead of throwing', () => {
    // timingSafeEqual throws on mismatched lengths; the guard must catch it first.
    expect(() => isSameOAuthState('short', 'considerably-longer')).not.toThrow()
    expect(isSameOAuthState('short', 'considerably-longer')).toBe(false)
  })

  it('rejects a prefix of the expected value', () => {
    const state = createOAuthState()
    expect(isSameOAuthState(state.slice(0, -1), state)).toBe(false)
  })

  it('rejects an empty received value', () => {
    expect(isSameOAuthState('', createOAuthState())).toBe(false)
  })
})
