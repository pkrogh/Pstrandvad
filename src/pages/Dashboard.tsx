import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, FolderKanban, Gauge } from 'lucide-react'
import { useStore } from '../store/store'
import type { Task } from '../types'
import { completedPerWeek, isOverdue, memberWeeklyLoad, projectProgress, projectTasks, timeElapsed, upcomingWeeks } from '../lib/analytics'
import { daysUntil, relativeDue, timeAgo } from '../lib/dates'
import { Avatar, Card, CardHeader, EmptyState, HealthBadge, PageHeader, PriorityBadge, ProgressBar, cx } from '../components/ui'
import { TaskDialog } from '../components/TaskDialog'

export function Dashboard() {
  const { state } = useStore()
  const [editing, setEditing] = useState<Task | null>(null)
  const { projects, tasks, members, activity } = state

  const openTasks = tasks.filter((t) => t.status !== 'done')
  const overdue = openTasks.filter(isOverdue)
  const dueSoon = openTasks
    .filter((t) => daysUntil(t.dueDate) <= 7)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const activeProjects = projects.filter((p) => p.status === 'active' || p.status === 'planning')
  const atRisk = activeProjects.filter((p) => p.health !== 'on_track')

  const thisWeek = useMemo(() => upcomingWeeks(1), [])
  const load = members
    .map((m) => ({ member: m, hours: memberWeeklyLoad(m, tasks, thisWeek).hours[0] }))
    .sort((a, b) => b.hours / b.member.capacity - a.hours / a.member.capacity)
  const totalHours = load.reduce((s, l) => s + l.hours, 0)
  const totalCapacity = members.reduce((s, m) => s + m.capacity, 0)
  const utilization = totalCapacity ? Math.round((totalHours / totalCapacity) * 100) : 0
  const overloaded = load.filter((l) => l.hours > l.member.capacity).length

  const throughput = completedPerWeek(tasks, 8)
  const maxThroughput = Math.max(1, ...throughput.map((w) => w.count))

  const memberById = (id: string | null) => members.find((m) => m.id === id)
  const me = memberById(state.currentUserId ?? null)
  const projectById = (id: string) => projects.find((p) => p.id === id)

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader
        title={me ? `${greeting}, ${me.name.split(' ')[0]}` : greeting}
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' · Here’s what’s happening across your portfolio.'}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={FolderKanban} label="Open projects" value={activeProjects.length} detail={`${atRisk.length} need attention`} tone={atRisk.length ? 'warn' : 'ok'} to="/projects" />
        <Kpi icon={CheckCircle2} label="Open tasks" value={openTasks.length} detail={`${tasks.length - openTasks.length} completed overall`} to="/board" />
        <Kpi icon={AlertTriangle} label="Overdue tasks" value={overdue.length} detail={overdue.length ? 'Past their due date' : 'Nothing overdue'} tone={overdue.length ? 'bad' : 'ok'} to="/board?overdue=1" />
        <Kpi icon={Gauge} label="Team utilization" value={`${utilization}%`} detail={overloaded ? `${overloaded} people over capacity` : 'Everyone within capacity'} tone={overloaded ? 'warn' : 'ok'} to="/resources" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Project health"
            subtitle="Effort-weighted progress; the tick marks how much of the timeline has elapsed"
            action={
              <Link to="/projects" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                All projects <ArrowRight size={12} />
              </Link>
            }
          />
          <div className="divide-y divide-slate-100">
            {activeProjects.map((p) => {
              const pt = projectTasks(tasks, p.id)
              const progress = projectProgress(pt)
              const elapsed = timeElapsed(p)
              const owner = memberById(p.ownerId)
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                  <div className="col-span-12 flex min-w-0 items-center gap-3 sm:col-span-4">
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{p.name}</div>
                      <div className="truncate text-xs text-slate-500">{p.client}</div>
                    </div>
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <HealthBadge health={p.health} />
                  </div>
                  <div className="col-span-8 sm:col-span-4">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{progress}%</span>
                      <span>{relativeDue(p.dueDate)}</span>
                    </div>
                    <ProgressBar value={progress} color={p.color} marker={elapsed} />
                  </div>
                  <div className="col-span-2 hidden justify-end sm:flex">
                    <Avatar member={owner} size="sm" />
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Tasks completed per week" subtitle="Last 8 weeks, all projects" />
          <div className="px-5 pt-6 pb-4">
            <div className="flex h-40 items-end gap-2" role="img" aria-label="Bar chart of tasks completed per week">
              {throughput.map((w, i) => {
                const isCurrent = i === throughput.length - 1
                return (
                  <div key={w.iso} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                    <span className="mb-1 text-[11px] font-medium text-slate-600 opacity-0 transition group-hover:opacity-100">{w.count}</span>
                    <div
                      className={cx('w-full max-w-8 rounded-t-[4px] transition', isCurrent ? 'bg-blue-300' : 'bg-blue-600 group-hover:bg-blue-700')}
                      style={{ height: `${(w.count / maxThroughput) * 100}%`, minHeight: w.count ? 4 : 1 }}
                    />
                    <div className="pointer-events-none absolute -top-8 z-10 hidden rounded-md bg-slate-900 px-2 py-1 text-[11px] whitespace-nowrap text-white shadow group-hover:block">
                      Week of {w.label}: {w.count} task{w.count === 1 ? '' : 's'}
                      {isCurrent && ' (in progress)'}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex gap-2 border-t border-slate-200 pt-1.5">
              {throughput.map((w, i) => (
                <span key={w.iso} className="flex-1 text-center text-[10px] text-slate-400">
                  {i % 2 === 1 || i === throughput.length - 1 ? w.label : ''}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Due soon & overdue" subtitle="Open tasks due within 7 days" action={<CalendarClock size={16} className="text-slate-400" />} />
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
            {dueSoon.length === 0 && (
              <div className="p-5">
                <EmptyState title="Nothing due this week" />
              </div>
            )}
            {dueSoon.map((t) => {
              const p = projectById(t.projectId)
              const late = isOverdue(t)
              return (
                <button key={t.id} onClick={() => setEditing(t)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                  <Avatar member={memberById(t.assigneeId)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-slate-900">{t.title}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium" style={{ color: p?.color }}>
                        {p?.key}
                      </span>
                      <span className={cx(late && 'font-medium text-red-600')}>{relativeDue(t.dueDate)}</span>
                    </div>
                  </div>
                  <PriorityBadge priority={t.priority} />
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Workload this week"
            subtitle={`${Math.round(totalHours)}h planned of ${totalCapacity}h capacity`}
            action={
              <Link to="/resources" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                Details <ArrowRight size={12} />
              </Link>
            }
          />
          <div className="space-y-3 px-5 py-4">
            {load.slice(0, 7).map(({ member, hours }) => {
              const pct = Math.round((hours / member.capacity) * 100)
              const over = pct > 100
              return (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar member={member} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="truncate font-medium text-slate-700">{member.name}</span>
                      <span className={cx('flex items-center gap-1 tabular-nums', over ? 'font-semibold text-red-700' : 'text-slate-500')}>
                        {over && <AlertTriangle size={12} />}
                        {Math.round(hours)}h / {member.capacity}h
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className={cx('h-full rounded-full', over ? 'bg-red-500' : 'bg-blue-600')} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
          <ul className="max-h-96 space-y-4 overflow-y-auto px-5 py-4 scrollbar-thin">
            {activity.slice(0, 10).map((a) => {
              const p = projectById(a.projectId)
              return (
                <li key={a.id} className="flex gap-3">
                  <Avatar member={memberById(a.actorId)} size="sm" />
                  <div className="min-w-0 text-sm">
                    <p className="text-slate-700">
                      <span className="font-medium text-slate-900">{memberById(a.actorId)?.name.split(' ')[0] ?? a.actorName}</span> {a.text}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {p?.name ?? 'Deleted project'} · {timeAgo(a.at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>


      {editing && <TaskDialog task={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  to,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: React.ReactNode
  detail: string
  tone?: 'ok' | 'warn' | 'bad'
  to: string
}) {
  const toneClass = tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-500'
  return (
    <Link to={to} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Icon size={16} className="text-slate-400 group-hover:text-indigo-500" />
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
      <div className={cx('mt-1 flex items-center gap-1 text-xs', toneClass)}>
        {tone === 'bad' || tone === 'warn' ? <AlertTriangle size={12} /> : null}
        {detail}
      </div>
    </Link>
  )
}
