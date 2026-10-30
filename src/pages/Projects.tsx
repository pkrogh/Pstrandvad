import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus, Search } from 'lucide-react'
import { useStore } from '../store/store'
import type { ProjectStatus } from '../types'
import { PROJECT_STATUS_META, formatCurrency } from '../lib/meta'
import { isOverdue, projectProgress, projectTasks, timeElapsed } from '../lib/analytics'
import { formatDate } from '../lib/dates'
import { AvatarStack, Button, Card, EmptyState, HealthBadge, PageHeader, ProgressBar, ProjectStatusBadge, cx, inputClass } from '../components/ui'
import { ProjectDialog } from '../components/ProjectDialog'

const FILTERS: (ProjectStatus | 'all')[] = ['all', 'active', 'planning', 'on_hold', 'completed']

export function Projects() {
  const { state } = useStore()
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const q = query.trim().toLowerCase()
  const visible = state.projects.filter(
    (p) => (filter === 'all' || p.status === filter) && (!q || `${p.name} ${p.client} ${p.key}`.toLowerCase().includes(q)),
  )

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={`${state.projects.length} projects · ${formatCurrency(state.projects.reduce((s, p) => s + p.budget, 0))} total budget`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> New project
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5 scrollbar-thin">
          {FILTERS.map((f) => {
            const count = f === 'all' ? state.projects.length : state.projects.filter((p) => p.status === f).length
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cx(
                  'rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition',
                  filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {f === 'all' ? 'All' : PROJECT_STATUS_META[f].label}
                <span className="ml-1.5 text-xs text-slate-400">{count}</span>
              </button>
            )
          })}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
          <input className={inputClass + ' pl-8'} placeholder="Search projects…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No projects match" hint="Try a different filter or search term." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const pt = projectTasks(state.tasks, p.id)
            const progress = projectProgress(pt)
            const open = pt.filter((t) => t.status !== 'done').length
            const late = pt.filter(isOverdue).length
            const team = state.members.filter((m) => p.memberIds.includes(m.id) || m.id === p.ownerId)
            const burn = Math.round((p.spent / p.budget) * 100)
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="group min-w-0">
                <Card className="flex h-full flex-col p-5 transition group-hover:border-indigo-200 group-hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: p.color }}>
                        {p.key}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900">{p.name}</h3>
                        <p className="truncate text-xs text-slate-500">{p.client}</p>
                      </div>
                    </div>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">{p.description}</p>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{progress}% complete</span>
                      <HealthBadge health={p.health} />
                    </div>
                    <ProgressBar value={progress} color={p.color} marker={timeElapsed(p)} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-400">Open tasks</dt>
                      <dd className="font-medium text-slate-700">
                        {open}
                        {late > 0 && <span className="ml-1 text-red-600">({late} late)</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Budget used</dt>
                      <dd className={cx('font-medium', burn > 100 ? 'text-red-600' : 'text-slate-700')}>{burn}%</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Team</dt>
                      <dd className="font-medium text-slate-700">{team.length} people</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                    <AvatarStack members={team} />
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <CalendarDays size={13} />
                      {formatDate(p.startDate)} – {formatDate(p.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {creating && <ProjectDialog project={null} onClose={() => setCreating(false)} />}
    </>
  )
}
