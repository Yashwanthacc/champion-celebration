
const ITERATIONS = 100_000
const SALT_BYTES = 16
const KEY_BITS = 256

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer as ArrayBuffer
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations: ITERATIONS,
    },
    key,
    KEY_BITS
  )

  return `pbkdf2-sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(
    new Uint8Array(bits)
  )}`
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split('$')

  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') {
    return false
  }

  const iterations = Number(parts[1])

  if (!Number.isInteger(iterations) || iterations !== ITERATIONS) {
    return false
  }

  try {
    const salt = fromBase64(parts[2])
    const expected = fromBase64(parts[3])

    if (
      salt.length !== SALT_BYTES ||
      expected.length !== KEY_BITS / 8
    ) {
      return false
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    )

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: toArrayBuffer(salt),
        iterations,
      },
      key,
      KEY_BITS
    )

    const actual = new Uint8Array(bits)
    let difference = 0

    for (let i = 0; i < expected.length; i++) {
      difference |= actual[i] ^ expected[i]
    }

    return difference === 0
  } catch {
    return false
  }
}
