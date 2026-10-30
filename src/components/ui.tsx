import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Member, Priority, ProjectHealth, ProjectStatus } from '../types'
import { HEALTH_META, PRIORITY_META, PROJECT_STATUS_META } from '../lib/meta'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
}

export function Avatar({ member, size = 'md', ring }: { member?: Member | null; size?: 'xs' | 'sm' | 'md' | 'lg'; ring?: boolean }) {
  const dims = { xs: 'h-5 w-5 text-[9px]', sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-xs', lg: 'h-11 w-11 text-sm' }[size]
  if (!member)
    return (
      <span
        title="Unassigned"
        className={cx(dims, 'inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400', ring && 'ring-2 ring-white')}
      >
        ?
      </span>
    )
  return (
    <span
      title={member.name}
      style={{ backgroundColor: member.color }}
      className={cx(dims, 'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', ring && 'ring-2 ring-white')}
    >
      {initials(member.name)}
    </span>
  )
}

export function AvatarStack({ members, max = 4 }: { members: Member[]; max?: number }) {
  const shown = members.slice(0, max)
  const extra = members.length - shown.length
  return (
    <div className="flex -space-x-2">
      {shown.map((m) => (
        <Avatar key={m.id} member={m} size="sm" ring />
      ))}
      {extra > 0 && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-600 ring-2 ring-white">
          +{extra}
        </span>
      )}
    </div>
  )
}

export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', className)}>{children}</span>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority]
  return <Pill className={m.className}>{m.label}</Pill>
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const m = PROJECT_STATUS_META[status]
  return <Pill className={m.className}>{m.label}</Pill>
}

export function HealthBadge({ health }: { health: ProjectHealth }) {
  const m = HEALTH_META[health]
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs font-medium', m.className)}>
      <span className={cx('h-2 w-2 rounded-full', m.dot)} />
      {m.label}
    </span>
  )
}

export function ProgressBar({ value, color = '#4f46e5', marker }: { value: number; color?: string; marker?: number }) {
  return (
    <div className="relative h-1.5 w-full rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      {marker !== undefined && (
        <div title={`Time elapsed: ${marker}%`} className="absolute -top-1 h-3.5 w-0.5 rounded bg-slate-500" style={{ left: `calc(${marker}% - 1px)` }} />
      )}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>
}

export function CardHeader({ title, action, subtitle }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 shadow-sm',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50',
  }[variant]
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50',
        styles,
        className,
      )}
    />
  )
}

export const inputClass =
  'w-full rounded-lg border-0 bg-white px-3 py-1.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('w-full rounded-xl bg-white shadow-xl', wide ? 'max-w-2xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onEscape()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [active, onEscape])
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
