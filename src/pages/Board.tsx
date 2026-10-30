import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Plus, Search, X } from 'lucide-react'
import { useStore } from '../store/store'
import type { Priority, Task, TaskStatus } from '../types'
import { PRIORITIES, PRIORITY_META, STATUS_COLOR, STATUS_LABEL, TASK_STATUSES } from '../lib/meta'
import { isOverdue } from '../lib/analytics'
import { isoFromToday, relativeDue } from '../lib/dates'
import { Avatar, Button, PageHeader, PriorityBadge, cx, inputClass } from '../components/ui'
import { TaskDialog } from '../components/TaskDialog'

const selectClass =
  'rounded-lg border-0 bg-white py-1.5 pr-8 pl-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none'

export function Board() {
  const { state, dispatch } = useStore()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Task | { status: TaskStatus } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ status: TaskStatus; beforeId: string | null } | null>(null)

  const projectFilter = params.get('project') ?? ''
  const assigneeFilter = params.get('assignee') ?? ''
  const priorityFilter = (params.get('priority') ?? '') as Priority | ''
  const overdueOnly = params.get('overdue') === '1'
  const query = params.get('q') ?? ''

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const q = query.trim().toLowerCase()
  const filtered = state.tasks.filter(
    (t) =>
      (!projectFilter || t.projectId === projectFilter) &&
      (!assigneeFilter || (assigneeFilter === 'none' ? !t.assigneeId : t.assigneeId === assigneeFilter)) &&
      (!priorityFilter || t.priority === priorityFilter) &&
      (!overdueOnly || isOverdue(t)) &&
      (!q || `${t.title} ${t.tags.join(' ')}`.toLowerCase().includes(q)),
  )
  const hasFilters = projectFilter || assigneeFilter || priorityFilter || overdueOnly || q
  const projectById = (id: string) => state.projects.find((p) => p.id === id)
  const memberById = (id: string | null) => state.members.find((m) => m.id === id)

  function onDrop(status: TaskStatus) {
    if (dragId) dispatch({ type: 'task/move', id: dragId, status, beforeId: dropTarget?.beforeId ?? null })
    setDragId(null)
    setDropTarget(null)
  }

  function onCardDragOver(e: React.DragEvent, status: TaskStatus, taskId: string) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientY > rect.top + rect.height / 2
    const column = filtered.filter((t) => t.status === status && t.id !== dragId)
    const idx = column.findIndex((t) => t.id === taskId)
    const beforeId = after ? (column[idx + 1]?.id ?? null) : taskId
    if (dropTarget?.status !== status || dropTarget.beforeId !== beforeId) setDropTarget({ status, beforeId })
  }

  const projectOptions = state.projects.filter((p) => p.status !== 'completed' || p.id === projectFilter)

  return (
    <>
      <PageHeader
        title="Task board"
        subtitle="Drag cards between columns to change status, or click a card to edit it."
        actions={
          <Button onClick={() => setEditing({ status: 'todo' })}>
            <Plus size={16} /> New task
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
          <input className={inputClass + ' pl-8'} placeholder="Search tasks or tags…" value={query} onChange={(e) => setParam('q', e.target.value)} />
        </div>
        <select aria-label="Filter by project" className={selectClass} value={projectFilter} onChange={(e) => setParam('project', e.target.value)}>
          <option value="">All projects</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select aria-label="Filter by assignee" className={selectClass} value={assigneeFilter} onChange={(e) => setParam('assignee', e.target.value)}>
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {state.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select aria-label="Filter by priority" className={selectClass} value={priorityFilter} onChange={(e) => setParam('priority', e.target.value)}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setParam('overdue', overdueOnly ? '' : '1')}
          className={cx(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ring-1 ring-inset',
            overdueOnly ? 'bg-red-50 font-medium text-red-700 ring-red-200' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
          )}
        >
          <AlertTriangle size={14} /> Overdue only
        </button>
        {hasFilters && (
          <button onClick={() => setParams({}, { replace: true })} className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-500 hover:text-slate-800">
            <X size={14} /> Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">
          {filtered.length} of {state.tasks.length} tasks
        </span>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 scrollbar-thin sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-max gap-4">
          {TASK_STATUSES.map((status) => {
            const column = filtered.filter((t) => t.status === status)
            const hours = column.reduce((s, t) => s + t.estimate, 0)
            const isTarget = dragId && dropTarget?.status === status
            return (
              <section
                key={status}
                aria-label={STATUS_LABEL[status]}
                onDragOver={(e) => {
                  // Cards stop propagation, so reaching here means empty column space → append to end.
                  e.preventDefault()
                  if (dropTarget?.status !== status || dropTarget.beforeId !== null) setDropTarget({ status, beforeId: null })
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  onDrop(status)
                }}
                className={cx('flex w-72 flex-col rounded-xl bg-slate-100/80 transition', isTarget && 'bg-indigo-50 ring-2 ring-indigo-200')}
              >
                <header className="flex items-center justify-between px-3 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
                    <h2 className="text-sm font-semibold text-slate-700">{STATUS_LABEL[status]}</h2>
                    <span className="rounded-full bg-white px-1.5 text-xs font-medium text-slate-500 tabular-nums">{column.length}</span>
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums">{hours}h</span>
                </header>
                <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                  {column.map((t) => {
                    const p = projectById(t.projectId)
                    const a = memberById(t.assigneeId)
                    const late = isOverdue(t)
                    const showIndicator = isTarget && dropTarget?.beforeId === t.id && dragId !== t.id
                    return (
                      <div key={t.id}>
                        {showIndicator && <div className="mb-2 h-0.5 rounded bg-indigo-500" />}
                        <article
                          draggable
                          tabIndex={0}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', t.id)
                            setDragId(t.id)
                          }}
                          onDragEnd={() => {
                            setDragId(null)
                            setDropTarget(null)
                          }}
                          onDragOver={(e) => onCardDragOver(e, status, t.id)}
                          onClick={() => setEditing(t)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditing(t)}
                          className={cx(
                            'cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition select-none hover:border-slate-300 hover:shadow focus:ring-2 focus:ring-indigo-500 focus:outline-none active:cursor-grabbing',
                            dragId === t.id && 'opacity-40',
                          )}
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold tracking-wide" style={{ color: p?.color }}>
                              {p?.key}
                            </span>
                            <PriorityBadge priority={t.priority} />
                          </div>
                          <p className={cx('text-sm leading-snug font-medium', t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>{t.title}</p>
                          {t.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {t.tags.map((tag) => (
                                <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 flex items-center justify-between">
                            <span className={cx('flex items-center gap-1 text-xs', late ? 'font-medium text-red-600' : 'text-slate-500')}>
                              {late && <AlertTriangle size={12} />}
                              {t.status === 'done' ? 'Completed' : relativeDue(t.dueDate)}
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-400">{t.estimate}h</span>
                            </span>
                            <Avatar member={a} size="sm" />
                          </div>
                        </article>
                      </div>
                    )
                  })}
                  {isTarget && dropTarget?.beforeId === null && <div className="h-0.5 rounded bg-indigo-500" />}
                  <QuickAdd
                    onAdd={(title) =>
                      dispatch({
                        type: 'task/create',
                        task: {
                          title,
                          status,
                          projectId: projectFilter || projectOptions.find((p) => p.status === 'active')?.id || state.projects[0].id,
                          assigneeId: assigneeFilter && assigneeFilter !== 'none' ? assigneeFilter : null,
                          priority: priorityFilter || 'medium',
                          description: '',
                          estimate: 4,
                          startDate: isoFromToday(0),
                          dueDate: isoFromToday(7),
                          tags: [],
                        },
                      })
                    }
                  />
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {editing && (
        <TaskDialog
          task={'id' in editing ? editing : null}
          defaults={'id' in editing ? undefined : { status: editing.status, projectId: projectFilter || undefined }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function QuickAdd({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-white/70 hover:text-slate-700">
        <Plus size={14} /> Add task
      </button>
    )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim()) onAdd(title.trim())
        setTitle('')
      }}
    >
      <input
        autoFocus
        className={inputClass}
        placeholder="Task title, then Enter"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title && setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && (setTitle(''), setOpen(false))}
      />
    </form>
  )
}
