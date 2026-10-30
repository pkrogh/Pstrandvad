import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Priority, Task, TaskStatus } from '../types'
import { useStore } from '../store/store'
import { PRIORITIES, PRIORITY_META, STATUS_LABEL, TASK_STATUSES } from '../lib/meta'
import { formatDate, isoFromToday } from '../lib/dates'
import { Button, Field, Modal, inputClass } from './ui'

interface Props {
  /** Existing task to edit, or null to create a new one. */
  task: Task | null
  defaults?: Partial<Pick<Task, 'projectId' | 'status' | 'assigneeId'>>
  onClose: () => void
}

type Draft = Omit<Task, 'id' | 'createdAt' | 'completedAt'>

export function TaskDialog({ task, defaults, onClose }: Props) {
  const { state, dispatch } = useStore()
  const activeProjects = state.projects.filter((p) => p.status !== 'completed' || p.id === task?.projectId)
  const [draft, setDraft] = useState<Draft>(() =>
    task
      ? { ...task }
      : {
          projectId: defaults?.projectId ?? activeProjects[0]?.id ?? '',
          title: '',
          description: '',
          status: defaults?.status ?? 'todo',
          priority: 'medium',
          assigneeId: defaults?.assigneeId ?? null,
          estimate: 4,
          startDate: isoFromToday(0),
          dueDate: isoFromToday(7),
          tags: [],
        },
  )
  const [tagInput, setTagInput] = useState(draft.tags.join(', '))
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const project = state.projects.find((p) => p.id === draft.projectId)
  const team = state.members.filter((m) => project?.memberIds.includes(m.id) || project?.ownerId === m.id)
  const others = state.members.filter((m) => !team.includes(m))
  const valid = draft.title.trim() && draft.projectId && draft.dueDate >= draft.startDate

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const payload = {
      ...draft,
      title: draft.title.trim(),
      tags: tagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
    }
    if (task) dispatch({ type: 'task/update', id: task.id, patch: payload })
    else dispatch({ type: 'task/create', task: payload })
    onClose()
  }

  function remove() {
    if (task && confirm(`Delete “${task.title}”?`)) {
      dispatch({ type: 'task/delete', id: task.id })
      onClose()
    }
  }

  return (
    <Modal open onClose={onClose} title={task ? `Edit task · ${project?.name ?? ''}` : 'New task'} wide>
      <form onSubmit={save} className="space-y-4">
        <input
          autoFocus
          className="w-full border-0 p-0 text-lg font-semibold text-slate-900 placeholder:text-slate-300 focus:ring-0 focus:outline-none"
          placeholder="Task title"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
        />
        <textarea
          className={inputClass + ' min-h-20'}
          placeholder="Add a description…"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Project">
            <select className={inputClass} value={draft.projectId} onChange={(e) => set('projectId', e.target.value)}>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} value={draft.status} onChange={(e) => set('status', e.target.value as TaskStatus)}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inputClass} value={draft.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assignee">
            <select className={inputClass} value={draft.assigneeId ?? ''} onChange={(e) => set('assigneeId', e.target.value || null)}>
              <option value="">Unassigned</option>
              <optgroup label="Project team">
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Others">
                {others.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </Field>
          <Field label="Estimate (hours)">
            <input type="number" min={0.5} step={0.5} className={inputClass} value={draft.estimate} onChange={(e) => set('estimate', Number(e.target.value))} />
          </Field>
          <Field label="Tags (comma separated)">
            <input className={inputClass} value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="frontend, bug" />
          </Field>
          <Field label="Start date">
            <input type="date" className={inputClass} value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="Due date">
            <input type="date" className={inputClass} value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </Field>
        </div>
        {draft.dueDate < draft.startDate && <p className="text-xs text-red-600">Due date must be on or after the start date.</p>}
        {task && (
          <p className="text-xs text-slate-400">
            Created {formatDate(task.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
            {task.completedAt && ` · Completed ${formatDate(task.completedAt)}`}
          </p>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          {task ? (
            <Button type="button" variant="danger" onClick={remove}>
              <Trash2 size={14} /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid}>
              {task ? 'Save changes' : 'Create task'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
