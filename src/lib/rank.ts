/**
 * LexoRank-lite: generates lexicographically sortable position keys.
 *
 * rankBetween(a, b) returns a string that sorts between a and b.
 * rankBefore(a)     returns a string that sorts before a.
 * rankAfter(a)      returns a string that sorts after a.
 * initialRank()     returns a starting rank for the first node.
 *
 * Uses base-36 characters (0-9a-z). Keys grow in length only when
 * the midpoint can't be expressed in the same number of characters.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const BASE = ALPHABET.length // 36

function charToVal(c: string): number {
  const v = ALPHABET.indexOf(c)
  return v === -1 ? 0 : v
}

function valToChar(v: number): string {
  return ALPHABET[v]!
}

/**
 * Compute a string midpoint between `a` and `b`.
 * Precondition: a < b lexicographically.
 */
export function rankBetween(a: string, b: string): string {
  // Pad to equal length
  const maxLen = Math.max(a.length, b.length)
  const pa = a.padEnd(maxLen, ALPHABET[0]!)
  const pb = b.padEnd(maxLen, ALPHABET[0]!)

  // Convert to arrays of values
  const va = Array.from(pa).map(charToVal)
  const vb = Array.from(pb).map(charToVal)

  // Compute midpoint in base-36 arithmetic
  let carry = 0
  const sum: number[] = []
  for (let i = maxLen - 1; i >= 0; i--) {
    const s = va[i]! + vb[i]! + carry
    sum.unshift(s % BASE)
    carry = Math.floor(s / BASE)
  }
  if (carry) sum.unshift(carry)

  // Divide sum by 2
  const mid: number[] = []
  let remainder = 0
  for (const digit of sum) {
    const cur = remainder * BASE + digit
    mid.push(Math.floor(cur / 2))
    remainder = cur % 2
  }

  // If there's a remainder, we need an extra digit of precision
  if (remainder) {
    mid.push(Math.floor(BASE / 2))
  }

  // Trim leading zeros (but keep at least the length of original keys)
  let result = mid.map(valToChar).join('')
  // Remove leading zeros that were added by carry
  while (result.length > maxLen && result[0] === ALPHABET[0]) {
    result = result.slice(1)
  }

  // If midpoint equals a, append a middle character
  if (result <= a) {
    return a + ALPHABET[Math.floor(BASE / 2)]!
  }
  // If midpoint equals or exceeds b, append middle character to a
  if (result >= b) {
    return a + ALPHABET[Math.floor(BASE / 2)]!
  }

  return result
}

export function rankBefore(a: string): string {
  // Find a string before a
  const va = Array.from(a).map(charToVal)
  // Halve the value
  const half: number[] = []
  let remainder = 0
  for (const digit of va) {
    const cur = remainder * BASE + digit
    half.push(Math.floor(cur / 2))
    remainder = cur % 2
  }
  if (remainder) {
    half.push(Math.floor(BASE / 2))
  }
  const result = half.map(valToChar).join('')
  if (result === '' || result >= a) {
    return ALPHABET[0]! + a
  }
  return result
}

export function rankAfter(a: string): string {
  // Append a high-ish character
  return a + ALPHABET[Math.floor(BASE * 0.75)]!
}

export function initialRank(): string {
  return 'n' // middle of alphabet
}

/**
 * Generate N evenly spaced rank keys, useful for bulk inserts.
 */
export function generateRanks(count: number, before?: string, after?: string): string[] {
  const ranks: string[] = []
  let prev = before ?? ALPHABET[1]!
  const end = after ?? (ALPHABET[BASE - 1]! + ALPHABET[BASE - 1]!)

  for (let i = 0; i < count; i++) {
    const next = rankBetween(prev, end)
    ranks.push(next)
    prev = next
  }
  return ranks
}
