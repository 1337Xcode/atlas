import { describe, expect, it } from 'vitest'
import { describeSessionError } from './session-error.ts'

// test: distinguish the observed capacity response from credentials and account limits
describe('describeSessionError', () => {
  it('explains the provider capacity rejection captured during the connection check', () => {
    const error = new Error(
      'unexpected HTTP status 429 from create session: {"error":"no available capacity: no available servers to handle the request"}',
    )
    expect(describeSessionError(error)).toContain('no free servers')
    expect(describeSessionError(error)).not.toContain('API key')
  })
  it('does not call an ordinary session quota a capacity outage', () => {
    const error = Object.assign(new Error('Too many concurrent sessions'), { status: 429 })
    expect(describeSessionError(error)).toContain('session limit')
  })
  it('distinguishes authentication, billing, and model permissions', () => {
    expect(describeSessionError(Object.assign(new Error('expired'), { status: 401 }))).toContain(
      'authorization',
    )
    expect(describeSessionError(Object.assign(new Error('billing'), { status: 402 }))).toContain(
      'credits',
    )
    expect(describeSessionError(Object.assign(new Error('forbidden'), { status: 403 }))).toContain(
      'permission',
    )
  })
  it('does not guess what an undocumented L401 code means', () => {
    expect(describeSessionError(new Error('L401: request refused'))).toBe('L401: request refused')
  })
})
