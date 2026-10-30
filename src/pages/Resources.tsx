import { Fragment, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { useStore } from '../store/store'
import type { Task } from '../types'
import { allocateHours, memberWeeklyLoad, upcomingWeeks, utilizationClass } from '../lib/analytics'
import { relativeDue } from '../lib/dates'
import { Avatar, Card, CardHeader, EmptyState, PageHeader, PriorityBadge, cx } from '../components/ui'
import { TaskDialog } from '../components/TaskDialog'

const HORIZONS = [4, 8, 12]

export function Resources() {
  const { state, dispatch } = useStore()
  const [horizon, setHorizon] = useState(8)
  const [offset, setOffset] = useState(0)
  const [team, setTeam] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Task | null>(null)

  const weeks = useMemo(() => upcomingWeeks(horizon, offset), [horizon, offset])
  const teams = [...new Set(state.members.map((m) => m.team))]
  const members = state.members.filter((m) => !team || m.team === team)
  const projectById = (id: string) => state.projects.find((p) => p.id === id)

  const rows = members.map((m) => ({ member: m, ...memberWeeklyLoad(m, state.tasks, weeks) }))
  const totalCap = members.reduce((s, m) => s + m.capacity, 0) * weeks.length
  const totalAlloc = rows.reduce((s, r) => s + r.hours.reduce((a, b) => a + b, 0), 0)
  const overloadedCells = rows.reduce((s, r) => s + r.hours.filter((h) => h > r.member.capacity).length, 0)
  const overloadedPeople = rows.filter((r) => r.hours.some((h) => h > r.member.capacity)).length
  const weekTotals = weeks.map((_, i) => rows.reduce((s, r) => s + r.hours[i], 0))
  const weekCaps = members.reduce((s, m) => s + m.capacity, 0)

  const unassigned = state.tasks.filter((t) => !t.assigneeId && t.status !== 'done')
  const unassignedHours = unassigned.reduce((s, t) => s + allocateHours(t, weeks).reduce((a, b) => a + b, 0), 0)

  const reassign = (taskId: string, assigneeId: string) => dispatch({ type: 'task/update', id: taskId, patch: { assigneeId: assigneeId || null } })

  return (
    <>
      <PageHeader
        title="Resource allocation"
        subtitle="Planned hours per person per week, from open task estimates spread across each task's start → due window."
        actions={
          <>
            <select aria-label="Filter by team" className="rounded-lg border-0 bg-white py-1.5 pr-8 pl-3 text-sm ring-1 ring-slate-300 ring-inset" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={cx('rounded-md px-3 py-1 text-sm font-medium', horizon === h ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                >
                  {h}w
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-lg bg-white ring-1 ring-slate-300 ring-inset">
              <button aria-label="Previous weeks" onClick={() => setOffset((o) => o - 1)} className="p-1.5 text-slate-500 hover:text-slate-800">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setOffset(0)} className="px-2 text-sm text-slate-600 hover:text-slate-900">
                This week
              </button>
              <button aria-label="Next weeks" onClick={() => setOffset((o) => o + 1)} className="p-1.5 text-slate-500 hover:text-slate-800">
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Summary label="Capacity" value={`${Math.round(totalCap)}h`} sub={`${members.length} people × ${weeks.length} weeks`} />
        <Summary label="Planned" value={`${Math.round(totalAlloc)}h`} sub={`${totalCap ? Math.round((totalAlloc / totalCap) * 100) : 0}% average utilization`} />
        <Summary
          label="Over-allocated"
          value={`${overloadedPeople} people`}
          sub={overloadedCells ? `${overloadedCells} person-weeks over capacity` : 'No conflicts in range'}
          tone={overloadedPeople ? 'bad' : undefined}
        />
        <Summary label="Unassigned work" value={`${Math.round(unassignedHours)}h`} sub={`${unassigned.length} open tasks without an owner`} tone={unassigned.length ? 'warn' : undefined} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Weekly allocation" subtitle="Click a person to see and rebalance their tasks. Hover a cell for the project breakdown." action={<Legend />} />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-separate border-spacing-0.5 text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium">Person</th>
                {weeks.map((w, i) => (
                  <th key={w.iso} className={cx('min-w-16 px-1 py-2 text-center font-medium', offset + i === 0 && 'text-indigo-600')}>
                    {w.label}
                    {offset + i === 0 && <div className="text-[10px] font-normal">this week</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, hours, byProject, openTasks }) => {
                const isOpen = expanded === member.id
                return (
                  <Fragment key={member.id}>
                    <tr className="group">
                      <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-normal">
                        <button onClick={() => setExpanded(isOpen ? null : member.id)} className="flex w-56 items-center gap-2.5 rounded-lg px-2 py-1 text-left hover:bg-slate-50">
                          <Avatar member={member} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">{member.name}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {member.role} · {member.capacity}h/wk
                            </span>
                          </span>
                          {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </button>
                      </th>
                      {hours.map((h, i) => {
                        const pct = Math.round((h / member.capacity) * 100)
                        const breakdown = Object.entries(byProject)
                          .filter(([, arr]) => arr[i] > 0.05)
                          .sort((a, b) => b[1][i] - a[1][i])
                        return (
                          <td key={i} className="relative p-0">
                            <div className={cx('group/cell flex h-11 flex-col items-center justify-center rounded-md text-xs tabular-nums', utilizationClass(pct))}>
                              <span className="flex items-center gap-0.5 font-semibold">
                                {pct > 100 && <AlertTriangle size={11} />}
                                {h ? `${Math.round(h)}h` : '–'}
                              </span>
                              {h > 0 && <span className="text-[10px] opacity-80">{pct}%</span>}
                              {breakdown.length > 0 && (
                                <div className="pointer-events-none absolute top-full left-1/2 z-20 mt-1 hidden w-52 -translate-x-1/2 rounded-lg bg-slate-900 p-2.5 text-left text-white shadow-lg group-hover/cell:block">
                                  <div className="mb-1.5 text-[11px] text-slate-300">
                                    {member.name.split(' ')[0]} · week of {weeks[i].label}
                                  </div>
                                  {breakdown.map(([pid, arr]) => (
                                    <div key={pid} className="flex items-center justify-between gap-2 py-0.5 text-[11px]">
                                      <span className="flex min-w-0 items-center gap-1.5">
                                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: projectById(pid)?.color }} />
                                        <span className="truncate">{projectById(pid)?.name}</span>
                                      </span>
                                      <span className="font-semibold">{arr[i].toFixed(1)}h</span>
                                    </div>
                                  ))}
                                  <div className="mt-1 flex justify-between border-t border-slate-700 pt-1 text-[11px]">
                                    <span>Total</span>
                                    <span className="font-semibold">
                                      {h.toFixed(1)}h of {member.capacity}h
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={weeks.length + 1} className="px-4 pt-1 pb-4">
                          <MemberTasks
                            tasks={openTasks}
                            onOpen={setEditing}
                            onReassign={reassign}
                            members={state.members}
                            projectName={(id) => projectById(id)?.name ?? ''}
                            projectColor={(id) => projectById(id)?.color ?? '#94a3b8'}
                            selfId={member.id}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              <tr className="text-xs text-slate-500">
                <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium">
                  Team total
                </th>
                {weekTotals.map((h, i) => (
                  <td key={i} className="py-2 text-center tabular-nums">
                    <div className="font-semibold text-slate-700">{weekCaps ? Math.round((h / weekCaps) * 100) : 0}%</div>
                    <div className="text-[10px]">{Math.round(h)}h</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Unassigned open tasks" subtitle="Assign owners to bring planned work onto the schedule" />
        {unassigned.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Every open task has an owner" />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {unassigned.map((t) => {
              const p = projectById(t.projectId)
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p?.color }} />
                  <button onClick={() => setEditing(t)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm text-slate-900 hover:text-indigo-700">{t.title}</div>
                    <div className="text-xs text-slate-500">
                      {p?.name} · {t.estimate}h · {relativeDue(t.dueDate)}
                    </div>
                  </button>
                  <PriorityBadge priority={t.priority} />
                  <AssignSelect value="" members={state.members} onChange={(v) => reassign(t.id, v)} rows={rows} />
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {editing && <TaskDialog task={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function MemberTasks({
  tasks,
  members,
  selfId,
  onOpen,
  onReassign,
  projectName,
  projectColor,
}: {
  tasks: Task[]
  members: ReturnType<typeof useStore>['state']['members']
  selfId: string
  onOpen: (t: Task) => void
  onReassign: (taskId: string, memberId: string) => void
  projectName: (id: string) => string
  projectColor: (id: string) => string
}) {
  if (!tasks.length) return <EmptyState title="No open tasks assigned" />
  const sorted = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 px-4 py-2 text-xs font-medium text-slate-500">
        {tasks.length} open tasks · {tasks.reduce((s, t) => s + t.estimate, 0)}h estimated
      </div>
      <ul className="divide-y divide-slate-200">
        {sorted.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: projectColor(t.projectId) }} />
            <button onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm text-slate-900 hover:text-indigo-700">{t.title}</div>
              <div className="text-xs text-slate-500">
                {projectName(t.projectId)} · {t.estimate}h · {relativeDue(t.dueDate)}
              </div>
            </button>
            <PriorityBadge priority={t.priority} />
            <select
              aria-label={`Reassign ${t.title}`}
              className="rounded-md border-0 bg-white py-1 pr-7 pl-2 text-xs ring-1 ring-slate-300 ring-inset"
              value={selfId}
              onChange={(e) => onReassign(t.id, e.target.value)}
            >
              <option value="">Unassign</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === selfId ? `${m.name} (current)` : `Move to ${m.name}`}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AssignSelect({
  value,
  members,
  rows,
  onChange,
}: {
  value: string
  members: ReturnType<typeof useStore>['state']['members']
  rows: { member: { id: string; capacity: number }; hours: number[] }[]
  onChange: (v: string) => void
}) {
  // Show this-range utilization next to each name so the least-loaded person is easy to spot.
  const util = (id: string) => {
    const r = rows.find((x) => x.member.id === id)
    if (!r) return ''
    const pct = Math.round((r.hours.reduce((a, b) => a + b, 0) / (r.member.capacity * r.hours.length)) * 100)
    return ` (${pct}% loaded)`
  }
  return (
    <select aria-label="Assign to" className="rounded-md border-0 bg-white py-1 pr-7 pl-2 text-xs ring-1 ring-slate-300 ring-inset" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Assign to…</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
          {util(m.id)}
        </option>
      ))}
    </select>
  )
}

function Summary({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'bad' | 'warn' }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cx('mt-1 flex items-center gap-1.5 text-xl font-semibold tracking-tight', tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900')}>
        {tone && <AlertTriangle size={16} />}
        {value}
      </div>
      <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
    </Card>
  )
}

function Legend() {
  const steps = [
    { label: '0', cls: 'bg-slate-50 ring-1 ring-inset ring-slate-200' },
    { label: '<30%', cls: 'bg-blue-50 ring-1 ring-inset ring-blue-100' },
    { label: '30–60%', cls: 'bg-blue-200' },
    { label: '60–85%', cls: 'bg-blue-500' },
    { label: '85–100%', cls: 'bg-blue-700' },
  ]
  return (
    <div className="hidden flex-wrap items-center gap-3 text-[11px] text-slate-500 md:flex">
      {steps.map((s) => (
        <span key={s.label} className="flex items-center gap-1">
          <span className={cx('h-3 w-3 rounded-sm', s.cls)} />
          {s.label}
        </span>
      ))}
      <span className="flex items-center gap-1 text-red-700">
        <AlertTriangle size={11} /> Over capacity
      </span>
    </div>
  )
}
