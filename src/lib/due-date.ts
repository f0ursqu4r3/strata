function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isOverdue(ts: number): boolean {
  const today = startOfDay(new Date())
  return ts < today.getTime()
}

export function isDueToday(ts: number): boolean {
  const today = startOfDay(new Date())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return ts >= today.getTime() && ts < tomorrow.getTime()
}

export function isDueThisWeek(ts: number): boolean {
  const today = startOfDay(new Date())
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return ts >= today.getTime() && ts < weekEnd.getTime()
}

export type DueUrgency = 'overdue' | 'today' | 'soon' | 'normal' | null

export function dueDateUrgency(ts: number | null | undefined): DueUrgency {
  if (ts == null) return null
  if (isOverdue(ts)) return 'overdue'
  if (isDueToday(ts)) return 'today'
  const today = startOfDay(new Date())
  const soon = new Date(today)
  soon.setDate(soon.getDate() + 3)
  if (ts < soon.getTime()) return 'soon'
  return 'normal'
}

export function formatDueDate(ts: number): string {
  const today = startOfDay(new Date())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const due = startOfDay(new Date(ts))

  if (due.getTime() === today.getTime()) return 'Today'
  if (due.getTime() === tomorrow.getTime()) return 'Tomorrow'
  if (due.getTime() === yesterday.getTime()) return 'Yesterday'

  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/** Check if a due date matches a filter */
export function matchesDueDateFilter(
  dueDate: number | null | undefined,
  filter: 'all' | 'overdue' | 'today' | 'week',
): boolean {
  if (filter === 'all') return true
  if (dueDate == null) return false
  switch (filter) {
    case 'overdue': return isOverdue(dueDate)
    case 'today': return isDueToday(dueDate) || isOverdue(dueDate)
    case 'week': return isDueThisWeek(dueDate) || isOverdue(dueDate)
  }
}
