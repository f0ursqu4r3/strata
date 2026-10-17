import { describe, it, expect } from 'vitest'
import { buildOffsets, findRowAt } from '@/lib/row-offsets'

describe('row-offsets', () => {
  it('builds prefix sums with measured heights and the estimate', () => {
    const offsets = buildOffsets(['a', 'b', 'c'], new Map([['b', 50]]), 32)
    expect([...offsets]).toEqual([0, 32, 82, 114])
  })

  it('finds the row that contains a y position', () => {
    const offsets = buildOffsets(['a', 'b', 'c'], new Map([['b', 50]]), 32)
    expect(findRowAt(offsets, -10)).toBe(0)
    expect(findRowAt(offsets, 0)).toBe(0)
    expect(findRowAt(offsets, 31)).toBe(0)
    expect(findRowAt(offsets, 32)).toBe(1)
    expect(findRowAt(offsets, 81)).toBe(1)
    expect(findRowAt(offsets, 82)).toBe(2)
    expect(findRowAt(offsets, 9999)).toBe(2)
  })

  it('returns 0 when there are no rows', () => {
    expect(findRowAt(buildOffsets([], new Map(), 32), 100)).toBe(0)
  })
})
