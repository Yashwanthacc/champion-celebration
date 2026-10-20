
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './passwords'

describe('password helpers', () => {
  it('verifies the correct password', async () => {
    const hash = await hashPassword('Test-Password-123!')
    expect(await verifyPassword('Test-Password-123!', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('Test-Password-123!')
    expect(await verifyPassword('Wrong-Password-123!', hash)).toBe(false)
  })

  it('rejects an invalid stored hash', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false)
  })
})
    