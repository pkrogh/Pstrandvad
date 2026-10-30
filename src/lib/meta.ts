import type { Priority, ProjectHealth, ProjectStatus, TaskStatus } from '../types'

export const TASK_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done']

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
}

/** Status is ordinal, so it uses a single-hue ramp (light → dark) rather than rainbow hues. */
export const STATUS_COLOR: Record<TaskStatus, string> = {
  backlog: '#cbd5e1',
  todo: '#93c5fd',
  in_progress: '#3b82f6',
  review: '#1d4ed8',
  done: '#1e3a8a',
}

export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']

export const PRIORITY_META: Record<Priority, { label: string; className: string; rank: number }> = {
  urgent: { label: 'Urgent', className: 'bg-red-50 text-red-700 ring-red-200', rank: 0 },
  high: { label: 'High', className: 'bg-orange-50 text-orange-700 ring-orange-200', rank: 1 },
  medium: { label: 'Medium', className: 'bg-slate-100 text-slate-700 ring-slate-200', rank: 2 },
  low: { label: 'Low', className: 'bg-slate-50 text-slate-500 ring-slate-200', rank: 3 },
}

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; className: string }> = {
  planning: { label: 'Planning', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
  active: { label: 'Active', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  on_hold: { label: 'On hold', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
}

export const HEALTH_META: Record<ProjectHealth, { label: string; className: string; dot: string }> = {
  on_track: { label: 'On track', className: 'text-emerald-700', dot: 'bg-emerald-500' },
  at_risk: { label: 'At risk', className: 'text-amber-700', dot: 'bg-amber-500' },
  off_track: { label: 'Off track', className: 'text-red-700', dot: 'bg-red-500' },
}

export const PROJECT_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#65a30d']

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
