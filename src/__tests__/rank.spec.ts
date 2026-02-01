import { describe, it, expect } from 'vitest'
import {
  rankBetween,
  rankBefore,
  rankAfter,
  initialRank,
  generateRanks,
} from '@/lib/rank'

describe('rank', () => {
  describe('initialRank', () => {
    it('returns a non-empty string', () => {
      expect(initialRank()).toBeTruthy()
      expect(typeof initialRank()).toBe('string')
    })
  })

  describe('rankAfter', () => {
    it('returns a string that sorts after the input', () => {
      const a = initialRank()
      const b = rankAfter(a)
      expect(b > a).toBe(true)
    })

    it('works for multiple successive calls', () => {
      let prev = initialRank()
      for (let i = 0; i < 20; i++) {
        const next = rankAfter(prev)
        expect(next > prev).toBe(true)
        prev = next
      }
    })
  })

  describe('rankBefore', () => {
    it('returns a string that sorts before the input', () => {
      const a = initialRank()
      const b = rankBefore(a)
      expect(b < a).toBe(true)
    })

    it('works for multiple successive calls', () => {
      let prev = initialRank()
      for (let i = 0; i < 20; i++) {
        const next = rankBefore(prev)
        expect(next < prev).toBe(true)
        prev = next
      }
    })
  })

  describe('rankBetween', () => {
    it('returns a string between two inputs', () => {
      const a = 'b'
      const b = 'z'
      const mid = rankBetween(a, b)
      expect(mid > a).toBe(true)
      expect(mid < b).toBe(true)
    })

    it('works for adjacent characters', () => {
      const a = 'a'
      const b = 'c'
      const mid = rankBetween(a, b)
      expect(mid > a).toBe(true)
      expect(mid < b).toBe(true)
    })

    it('works when keys are close together', () => {
      const a = 'na'
      const b = 'nb'
      const mid = rankBetween(a, b)
      expect(mid > a).toBe(true)
      expect(mid < b).toBe(true)
    })

    it('produces unique keys for many insertions between the same pair', () => {
      const keys: string[] = ['a', 'z']
      for (let i = 0; i < 50; i++) {
        const mid = rankBetween(keys[keys.length - 2]!, keys[keys.length - 1]!)
        // Insert before the last element
        keys.splice(keys.length - 1, 0, mid)
      }
      // All keys should be unique
      expect(new Set(keys).size).toBe(keys.length)
      // All should be in sorted order
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i]! > keys[i - 1]!).toBe(true)
      }
    })
  })

  describe('generateRanks', () => {
    it('generates the requested number of ranks', () => {
      const ranks = generateRanks(5)
      expect(ranks).toHaveLength(5)
    })

    it('generates ranks in ascending order', () => {
      const ranks = generateRanks(10)
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i]! > ranks[i - 1]!).toBe(true)
      }
    })

    it('generates unique ranks', () => {
      const ranks = generateRanks(20)
      expect(new Set(ranks).size).toBe(20)
    })
  })
})
