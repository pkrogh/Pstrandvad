import type { Member, Project, Task } from '../types'
import { addDays, daysUntil, parseIso, startOfWeek, today, toIso } from './dates'

export function projectTasks(tasks: Task[], projectId: string) {
  return tasks.filter((t) => t.projectId === projectId)
}

/** Progress weighted by estimated effort. */
export function projectProgress(tasks: Task[]): number {
  const total = tasks.reduce((s, t) => s + t.estimate, 0)
  // Without estimates (common for imported work items), fall back to task count.
  if (!total) return tasks.length ? Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100) : 0
  const done = tasks.filter((t) => t.status === 'done').reduce((s, t) => s + t.estimate, 0)
  return Math.round((done / total) * 100)
}

/** How far through its timeline the project is (0–100). */
export function timeElapsed(project: Project): number {
  const start = parseIso(project.startDate).getTime()
  const end = parseIso(project.dueDate).getTime()
  const now = today().getTime()
  if (now <= start) return 0
  if (now >= end) return 100
  return Math.round(((now - start) / (end - start)) * 100)
}

export function isOverdue(t: Task) {
  return t.status !== 'done' && daysUntil(t.dueDate) < 0
}

export interface Week {
  start: Date
  label: string
  iso: string
}

export function upcomingWeeks(count: number, offset = 0): Week[] {
  const first = startOfWeek(today())
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(first, (i + offset) * 7)
    return {
      start,
      iso: toIso(start),
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
  })
}

/**
 * Spread each open task's estimate evenly over the working weeks between its
 * start and due date. Work scheduled in the past (overdue / late start) is
 * pulled into the current week, since it still has to be done.
 */
export function allocateHours(task: Task, weeks: Week[]): number[] {
  const result = weeks.map(() => 0)
  if (task.status === 'done' || !weeks.length) return result
  const thisWeek = startOfWeek(today()).getTime()
  const startW = Math.max(startOfWeek(parseIso(task.startDate)).getTime(), thisWeek)
  const dueW = Math.max(startOfWeek(parseIso(task.dueDate)).getTime(), thisWeek)
  const spanWeeks = Math.round((dueW - startW) / (7 * 86400000)) + 1
  const remaining = task.status === 'review' ? task.estimate * 0.25 : task.status === 'in_progress' ? task.estimate * 0.6 : task.estimate
  const perWeek = remaining / spanWeeks
  weeks.forEach((w, i) => {
    const t = w.start.getTime()
    if (t >= startW && t <= dueW) result[i] = perWeek
  })
  return result
}

export function memberWeeklyLoad(member: Member, tasks: Task[], weeks: Week[]) {
  const mine = tasks.filter((t) => t.assigneeId === member.id && t.status !== 'done')
  const hours = weeks.map(() => 0)
  const byProject: Record<string, number[]> = {}
  for (const t of mine) {
    const alloc = allocateHours(t, weeks)
    alloc.forEach((h, i) => {
      hours[i] += h
      ;(byProject[t.projectId] ??= weeks.map(() => 0))[i] += h
    })
  }
  return { hours, byProject, openTasks: mine }
}

export function utilizationClass(pct: number): string {
  // Sequential single-hue ramp for magnitude; overload switches to the reserved critical colour + icon.
  if (pct > 100) return 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-300'
  if (pct >= 85) return 'bg-blue-700 text-white'
  if (pct >= 60) return 'bg-blue-500 text-white'
  if (pct >= 30) return 'bg-blue-200 text-blue-900'
  if (pct > 0) return 'bg-blue-50 text-blue-900'
  return 'bg-slate-50 text-slate-400'
}

/** Count of tasks completed per week, for the last `count` weeks (oldest first). */
export function completedPerWeek(tasks: Task[], count: number) {
  const weeks = upcomingWeeks(count, -(count - 1))
  return weeks.map((w) => {
    const end = addDays(w.start, 7).getTime()
    const n = tasks.filter((t) => {
      if (!t.completedAt) return false
      const c = parseIso(t.completedAt).getTime()
      return c >= w.start.getTime() && c < end
    }).length
    return { ...w, count: n }
  })
}
