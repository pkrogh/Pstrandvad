import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ExternalLink, Pencil, Plus, SquareKanban } from 'lucide-react'
import { useStore } from '../store/store'
import type { ProjectHealth, ProjectStatus, Task, TaskStatus } from '../types'
import { HEALTH_META, PRIORITY_META, PROJECT_STATUS_META, STATUS_COLOR, STATUS_LABEL, TASK_STATUSES, formatCurrency } from '../lib/meta'
import { isOverdue, memberWeeklyLoad, projectProgress, projectTasks, timeElapsed, upcomingWeeks } from '../lib/analytics'
import { daysUntil, formatDate, relativeDue } from '../lib/dates'
import { Avatar, Button, Card, CardHeader, EmptyState, PageHeader, PriorityBadge, ProgressBar, cx } from '../components/ui'
import { TaskDialog } from '../components/TaskDialog'
import { ProjectDialog } from '../components/ProjectDialog'

type SortKey = 'status' | 'priority' | 'dueDate' | 'assignee'

export function ProjectDetail() {
  const { id } = useParams()
  const { state, dispatch } = useStore()
  const [editingTask, setEditingTask] = useState<Task | 'new' | null>(null)
  const [editingProject, setEditingProject] = useState(false)
  const [sort, setSort] = useState<SortKey>('status')
  const [hideDone, setHideDone] = useState(false)
  const weeks = useMemo(() => upcomingWeeks(1), [])

  const project = state.projects.find((p) => p.id === id)
  if (!project)
    return (
      <div className="py-20">
        <EmptyState title="Project not found" hint="It may have been removed. Reset demo data from the sidebar to restore it." />
      </div>
    )

  const tasks = projectTasks(state.tasks, project.id)
  const progress = projectProgress(tasks)
  const elapsed = timeElapsed(project)
  const daysLeft = daysUntil(project.dueDate)
  const burn = project.budget ? Math.round((project.spent / project.budget) * 100) : null
  const owner = state.members.find((m) => m.id === project.ownerId)
  const team = state.members.filter((m) => project.memberIds.includes(m.id) || m.id === project.ownerId)
  const memberById = (mid: string | null) => state.members.find((m) => m.id === mid)
  const counts = TASK_STATUSES.map((s) => ({ status: s, count: tasks.filter((t) => t.status === s).length }))
  const overdue = tasks.filter(isOverdue).length

  const statusRank = (s: TaskStatus) => TASK_STATUSES.indexOf(s)
  const sorted = [...tasks]
    .filter((t) => !hideDone || t.status !== 'done')
    .sort((a, b) => {
      switch (sort) {
        case 'status':
          return statusRank(b.status) - statusRank(a.status) || a.dueDate.localeCompare(b.dueDate)
        case 'priority':
          return PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank
        case 'dueDate':
          return a.dueDate.localeCompare(b.dueDate)
        case 'assignee':
          return (memberById(a.assigneeId)?.name ?? 'zzz').localeCompare(memberById(b.assigneeId)?.name ?? 'zzz')
      }
    })

  const update = (patch: Partial<typeof project>) => dispatch({ type: 'project/update', id: project.id, patch })

  return (
    <>
      <Link to="/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={14} /> Projects
      </Link>
      <PageHeader
        title={project.name}
        subtitle={`${project.key} · ${project.client} · Owned by ${owner?.name ?? '—'}`}
        actions={
          <>
            <select
              aria-label="Project status"
              className="rounded-lg border-0 bg-white py-1.5 pr-8 pl-3 text-sm ring-1 ring-slate-300 ring-inset"
              value={project.status}
              onChange={(e) => update({ status: e.target.value as ProjectStatus })}
            >
              {Object.entries(PROJECT_STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Project health"
              className={cx('rounded-lg border-0 bg-white py-1.5 pr-8 pl-3 text-sm font-medium ring-1 ring-slate-300 ring-inset', HEALTH_META[project.health].className)}
              value={project.health}
              onChange={(e) => update({ health: e.target.value as ProjectHealth })}
            >
              {Object.entries(HEALTH_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            {project.url && (
              <a href={project.url} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <ExternalLink size={14} /> Azure DevOps
                </Button>
              </a>
            )}
            <Button variant="secondary" onClick={() => setEditingProject(true)}>
              <Pencil size={14} /> Edit
            </Button>
            <Link to={`/board?project=${project.id}`}>
              <Button variant="secondary">
                <SquareKanban size={14} /> Board
              </Button>
            </Link>
            <Button onClick={() => setEditingTask('new')}>
              <Plus size={16} /> Add task
            </Button>
          </>
        }
      />

      <p className="-mt-3 mb-6 max-w-3xl text-sm text-slate-600">{project.description}</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Progress" value={`${progress}%`} sub={`${elapsed}% of timeline elapsed`}>
          <ProgressBar value={progress} color={project.color} marker={elapsed} />
        </Stat>
        <Stat
          label="Timeline"
          value={project.status === 'completed' ? 'Done' : daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days late`}
          sub={`${formatDate(project.startDate)} – ${formatDate(project.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })}`}
          tone={daysLeft < 0 && project.status !== 'completed' ? 'bad' : undefined}
        />
        {burn === null ? (
          <Stat label="Milestones" value={`${project.milestones.filter((m) => m.done).length} / ${project.milestones.length} done`} sub={project.milestones.length ? 'Features in this epic' : 'No features yet'} />
        ) : (
          <Stat label="Budget" value={`${burn}% used`} sub={`${formatCurrency(project.spent)} of ${formatCurrency(project.budget)}`} tone={burn > 100 ? 'bad' : burn > progress + 15 ? 'warn' : undefined}>
            <ProgressBar value={burn} color={burn > 100 ? '#dc2626' : '#64748b'} />
          </Stat>
        )}
        <Stat label="Open tasks" value={String(tasks.length - counts[4].count)} sub={overdue ? `${overdue} overdue` : 'None overdue'} tone={overdue ? 'bad' : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Task breakdown" subtitle={`${tasks.length} tasks · ${tasks.reduce((s, t) => s + t.estimate, 0)}h estimated`} />
            <div className="px-5 py-4">
              <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Tasks by status">
                {counts
                  .filter((c) => c.count)
                  .map((c) => (
                    <div key={c.status} title={`${STATUS_LABEL[c.status]}: ${c.count}`} style={{ flexGrow: c.count, backgroundColor: STATUS_COLOR[c.status] }} />
                  ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                {counts.map((c) => (
                  <span key={c.status} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLOR[c.status] }} />
                    {STATUS_LABEL[c.status]} <span className="font-semibold text-slate-900 tabular-nums">{c.count}</span>
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Tasks"
              action={
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 text-slate-600">
                    <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="rounded border-slate-300" />
                    Hide done
                  </label>
                  <select aria-label="Sort tasks" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border-0 py-1 pr-7 pl-2 text-xs ring-1 ring-slate-300 ring-inset">
                    <option value="status">Sort: status</option>
                    <option value="priority">Sort: priority</option>
                    <option value="dueDate">Sort: due date</option>
                    <option value="assignee">Sort: assignee</option>
                  </select>
                </div>
              }
            />
            {sorted.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No tasks yet" hint="Add the first task to get started." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="px-5 py-2 font-medium">Task</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Priority</th>
                      <th className="px-3 py-2 font-medium">Assignee</th>
                      <th className="px-3 py-2 text-right font-medium">Est.</th>
                      <th className="px-5 py-2 font-medium">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sorted.map((t) => {
                      const a = memberById(t.assigneeId)
                      const late = isOverdue(t)
                      return (
                        <tr key={t.id} onClick={() => setEditingTask(t)} className="cursor-pointer hover:bg-slate-50">
                          <td className="max-w-xs px-5 py-2.5">
                            <div className={cx('truncate', t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900')}>{t.title}</div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[t.status] }} />
                              {STATUS_LABEL[t.status]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <PriorityBadge priority={t.priority} />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2 text-xs whitespace-nowrap text-slate-600">
                              <Avatar member={a} size="xs" />
                              {a?.name ?? 'Unassigned'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-slate-500 tabular-nums">{t.estimate}h</td>
                          <td className={cx('px-5 py-2.5 text-xs whitespace-nowrap', late ? 'font-medium text-red-600' : 'text-slate-500')}>
                            {t.status === 'done' ? formatDate(t.dueDate) : relativeDue(t.dueDate)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Milestones" subtitle="Click to toggle completion" />
            <ol className="relative px-5 py-4">
              {project.milestones.length === 0 && <EmptyState title="No milestones" />}
              {[...project.milestones]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((m, i, arr) => {
                  const late = !m.done && daysUntil(m.date) < 0
                  return (
                    <li key={m.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < arr.length - 1 && <span className="absolute top-6 left-[11px] h-full w-px bg-slate-200" />}
                      <button
                        onClick={() => dispatch({ type: 'milestone/toggle', projectId: project.id, milestoneId: m.id })}
                        aria-label={m.done ? `Mark ${m.name} as not done` : `Mark ${m.name} as done`}
                        className={cx(
                          'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 transition',
                          m.done ? 'bg-emerald-500 text-white ring-emerald-500' : late ? 'bg-white ring-red-400' : 'bg-white ring-slate-300 hover:ring-slate-400',
                        )}
                      >
                        {m.done && <Check size={14} />}
                      </button>
                      <div>
                        <div className={cx('text-sm font-medium', m.done ? 'text-slate-500' : 'text-slate-900')}>{m.name}</div>
                        <div className={cx('text-xs', late ? 'text-red-600' : 'text-slate-500')}>
                          {formatDate(m.date, { month: 'short', day: 'numeric', year: 'numeric' })}
                          {late && ' · missed'}
                        </div>
                      </div>
                    </li>
                  )
                })}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Team" subtitle="Open work on this project · load across all projects this week" />
            <ul className="divide-y divide-slate-100">
              {team.map((m) => {
                const mine = tasks.filter((t) => t.assigneeId === m.id && t.status !== 'done')
                const weekHours = memberWeeklyLoad(m, state.tasks, weeks).hours[0]
                const pct = Math.round((weekHours / m.capacity) * 100)
                return (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar member={m} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {m.name}
                        {m.id === project.ownerId && <span className="ml-1.5 text-xs font-normal text-indigo-600">Owner</span>}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {m.role} · {mine.length} open task{mine.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className={cx('text-xs tabular-nums', pct > 100 ? 'font-semibold text-red-700' : 'text-slate-500')}>{pct}%</span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>

      {editingTask && (
        <TaskDialog task={editingTask === 'new' ? null : editingTask} defaults={{ projectId: project.id }} onClose={() => setEditingTask(null)} />
      )}
      {editingProject && <ProjectDialog project={project} onClose={() => setEditingProject(false)} />}
    </>
  )
}

function Stat({ label, value, sub, tone, children }: { label: string; value: string; sub: string; tone?: 'bad' | 'warn'; children?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cx('mt-1 text-xl font-semibold tracking-tight', tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900')}>{value}</div>
      <div className="mt-0.5 mb-2 text-xs text-slate-500">{sub}</div>
      {children}
    </Card>
  )
}
