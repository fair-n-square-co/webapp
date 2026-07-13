import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAuthServiceConfig, getWorkOSConfig } from './config.server'

const WORKOS_ENV = {
  WORKOS_API_KEY: 'sk_test_key',
  WORKOS_CLIENT_ID: 'client_123',
  WORKOS_COOKIE_PASSWORD: 'a'.repeat(32),
  WORKOS_REDIRECT_URI: 'http://localhost:3000/auth/callback',
} as const

const VALID_ENV = {
  ...WORKOS_ENV,
  AUTH_SERVICE_BASE_URL: 'http://localhost:8080',
} as const

let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  originalEnv = { ...process.env }
  Object.assign(process.env, VALID_ENV)
})

afterEach(() => {
  process.env = originalEnv
})

describe('getWorkOSConfig', () => {
  it('reads every WorkOS setting from the environment', () => {
    expect(getWorkOSConfig()).toEqual({
      apiKey: 'sk_test_key',
      clientId: 'client_123',
      cookiePassword: 'a'.repeat(32),
      redirectUri: 'http://localhost:3000/auth/callback',
    })
  })

  it.each(Object.keys(WORKOS_ENV))('throws when %s is missing', (name) => {
    delete process.env[name]
    expect(() => getWorkOSConfig()).toThrow(`Missing required environment variable: ${name}`)
  })

  it.each(Object.keys(WORKOS_ENV))('throws when %s is empty', (name) => {
    process.env[name] = ''
    expect(() => getWorkOSConfig()).toThrow(`Missing required environment variable: ${name}`)
  })

  it('rejects a cookie password too short for the seal key', () => {
    process.env['WORKOS_COOKIE_PASSWORD'] = 'a'.repeat(31)
    expect(() => getWorkOSConfig()).toThrow(/at least 32 characters, got 31/)
  })

  it('accepts a cookie password of exactly the minimum length', () => {
    process.env['WORKOS_COOKIE_PASSWORD'] = 'a'.repeat(32)
    expect(getWorkOSConfig().cookiePassword).toHaveLength(32)
  })
})

describe('getAuthServiceConfig', () => {
  it('reads the auth service base URL from the environment', () => {
    expect(getAuthServiceConfig()).toEqual({ baseUrl: 'http://localhost:8080' })
  })

  it('throws when AUTH_SERVICE_BASE_URL is missing', () => {
    delete process.env['AUTH_SERVICE_BASE_URL']
    expect(() => getAuthServiceConfig()).toThrow(
      'Missing required environment variable: AUTH_SERVICE_BASE_URL',
    )
  })

  it('rejects a base URL that is not absolute', () => {
    // connectRPC only appends the method path to this, so a relative value would fail
    // later as a puzzling 404 rather than here as a misconfiguration.
    process.env['AUTH_SERVICE_BASE_URL'] = '/auth'
    expect(() => getAuthServiceConfig()).toThrow(/must be an absolute URL/)
  })
})
