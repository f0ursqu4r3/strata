import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isOverdue,
  isDueToday,
  isDueThisWeek,
  dueDateUrgency,
  formatDueDate,
  matchesDueDateFilter,
} from '@/lib/due-date'

// Fixed reference: Jan 15 2025, noon local time
const NOW = new Date(2025, 0, 15, 12, 0, 0)

function dayOffset(days: number): number {
  const d = new Date(2025, 0, 15, 12, 0, 0)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

describe('due-date', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('isOverdue', () => {
    it('returns true for yesterday', () => {
      expect(isOverdue(dayOffset(-1))).toBe(true)
    })

    it('returns true for a week ago', () => {
      expect(isOverdue(dayOffset(-7))).toBe(true)
    })

    it('returns false for today', () => {
      expect(isOverdue(dayOffset(0))).toBe(false)
    })

    it('returns false for tomorrow', () => {
      expect(isOverdue(dayOffset(1))).toBe(false)
    })
  })

  describe('isDueToday', () => {
    it('returns true for today noon', () => {
      expect(isDueToday(dayOffset(0))).toBe(true)
    })

    it('returns false for yesterday', () => {
      expect(isDueToday(dayOffset(-1))).toBe(false)
    })

    it('returns false for tomorrow', () => {
      expect(isDueToday(dayOffset(1))).toBe(false)
    })
  })

  describe('isDueThisWeek', () => {
    it('returns true for today', () => {
      expect(isDueThisWeek(dayOffset(0))).toBe(true)
    })

    it('returns true for 3 days from now', () => {
      expect(isDueThisWeek(dayOffset(3))).toBe(true)
    })

    it('returns true for 6 days from now', () => {
      expect(isDueThisWeek(dayOffset(6))).toBe(true)
    })

    it('returns false for 8 days from now', () => {
      expect(isDueThisWeek(dayOffset(8))).toBe(false)
    })

    it('returns false for yesterday', () => {
      expect(isDueThisWeek(dayOffset(-1))).toBe(false)
    })
  })

  describe('dueDateUrgency', () => {
    it('returns null for null/undefined', () => {
      expect(dueDateUrgency(null)).toBeNull()
      expect(dueDateUrgency(undefined)).toBeNull()
    })

    it('returns overdue for past dates', () => {
      expect(dueDateUrgency(dayOffset(-1))).toBe('overdue')
    })

    it('returns today for today', () => {
      expect(dueDateUrgency(dayOffset(0))).toBe('today')
    })

    it('returns soon for within 3 days (but not today)', () => {
      expect(dueDateUrgency(dayOffset(1))).toBe('soon')
      expect(dueDateUrgency(dayOffset(2))).toBe('soon')
    })

    it('returns normal for 3+ days away', () => {
      expect(dueDateUrgency(dayOffset(3))).toBe('normal')
      expect(dueDateUrgency(dayOffset(10))).toBe('normal')
    })
  })

  describe('formatDueDate', () => {
    it('returns Today for today', () => {
      expect(formatDueDate(dayOffset(0))).toBe('Today')
    })

    it('returns Tomorrow for tomorrow', () => {
      expect(formatDueDate(dayOffset(1))).toBe('Tomorrow')
    })

    it('returns Yesterday for yesterday', () => {
      expect(formatDueDate(dayOffset(-1))).toBe('Yesterday')
    })

    it('returns formatted date for other days', () => {
      const result = formatDueDate(dayOffset(10))
      // Should be "Jan 25" or locale equivalent
      expect(result).not.toBe('Today')
      expect(result).not.toBe('Tomorrow')
      expect(result).not.toBe('Yesterday')
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('matchesDueDateFilter', () => {
    it('returns true for "all" filter regardless of date', () => {
      expect(matchesDueDateFilter(null, 'all')).toBe(true)
      expect(matchesDueDateFilter(dayOffset(-5), 'all')).toBe(true)
      expect(matchesDueDateFilter(dayOffset(5), 'all')).toBe(true)
    })

    it('returns false for non-all filters when date is null', () => {
      expect(matchesDueDateFilter(null, 'overdue')).toBe(false)
      expect(matchesDueDateFilter(null, 'today')).toBe(false)
      expect(matchesDueDateFilter(null, 'week')).toBe(false)
    })

    it('overdue filter matches past dates only', () => {
      expect(matchesDueDateFilter(dayOffset(-1), 'overdue')).toBe(true)
      expect(matchesDueDateFilter(dayOffset(0), 'overdue')).toBe(false)
      expect(matchesDueDateFilter(dayOffset(1), 'overdue')).toBe(false)
    })

    it('today filter matches today and overdue', () => {
      expect(matchesDueDateFilter(dayOffset(0), 'today')).toBe(true)
      expect(matchesDueDateFilter(dayOffset(-1), 'today')).toBe(true)
      expect(matchesDueDateFilter(dayOffset(1), 'today')).toBe(false)
    })

    it('week filter matches this week and overdue', () => {
      expect(matchesDueDateFilter(dayOffset(0), 'week')).toBe(true)
      expect(matchesDueDateFilter(dayOffset(3), 'week')).toBe(true)
      expect(matchesDueDateFilter(dayOffset(-1), 'week')).toBe(true)
      expect(matchesDueDateFilter(dayOffset(8), 'week')).toBe(false)
    })
  })
})
