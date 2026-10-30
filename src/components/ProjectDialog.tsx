import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Project, ProjectHealth, ProjectStatus } from '../types'
import { useStore } from '../store/store'
import { HEALTH_META, PROJECT_COLORS, PROJECT_STATUS_META } from '../lib/meta'
import { isoFromToday } from '../lib/dates'
import { Avatar, Button, Field, Modal, cx, inputClass } from './ui'

type Draft = Omit<Project, 'id'>

export function ProjectDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(() =>
    project
      ? { ...project }
      : {
          key: '',
          name: '',
          client: 'Internal',
          description: '',
          status: 'planning',
          health: 'on_track',
          ownerId: state.currentUserId ?? state.members[0]?.id ?? '',
          memberIds: [],
          startDate: isoFromToday(0),
          dueDate: isoFromToday(60),
          budget: 50000,
          spent: 0,
          color: PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length],
          milestones: [],
        },
  )
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const valid = draft.name.trim() && draft.key.trim() && draft.dueDate >= draft.startDate

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const payload = { ...draft, name: draft.name.trim(), key: draft.key.trim().toUpperCase() }
    if (project) {
      dispatch({ type: 'project/update', id: project.id, patch: payload })
      onClose()
    } else {
      dispatch({ type: 'project/create', project: payload })
      onClose()
      navigate('/projects')
    }
  }

  function toggleMember(id: string) {
    set('memberIds', draft.memberIds.includes(id) ? draft.memberIds.filter((m) => m !== id) : [...draft.memberIds, id])
  }

  return (
    <Modal open onClose={onClose} title={project ? 'Edit project' : 'New project'} wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3">
            <Field label="Name">
              <input
                autoFocus
                className={inputClass}
                value={draft.name}
                onChange={(e) => {
                  const name = e.target.value
                  setDraft((d) => ({ ...d, name, key: project || d.key.length > 3 ? d.key : name.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() }))
                }}
                placeholder="e.g. Customer Portal"
              />
            </Field>
          </div>
          <Field label="Key">
            <input className={inputClass} maxLength={5} value={draft.key} onChange={(e) => set('key', e.target.value.toUpperCase())} />
          </Field>
        </div>
        <Field label="Client">
          <input className={inputClass} value={draft.client} onChange={(e) => set('client', e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className={inputClass + ' min-h-16'} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Status">
            <select className={inputClass} value={draft.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
              {Object.entries(PROJECT_STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Health">
            <select className={inputClass} value={draft.health} onChange={(e) => set('health', e.target.value as ProjectHealth)}>
              {Object.entries(HEALTH_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start">
            <input type="date" className={inputClass} value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="Due">
            <input type="date" className={inputClass} value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </Field>
          <Field label="Budget (€)">
            <input type="number" min={0} step={1000} className={inputClass} value={draft.budget} onChange={(e) => set('budget', Number(e.target.value))} />
          </Field>
          <Field label="Spent (€)">
            <input type="number" min={0} step={500} className={inputClass} value={draft.spent} onChange={(e) => set('spent', Number(e.target.value))} />
          </Field>
          <Field label="Owner">
            <select className={inputClass} value={draft.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Color">
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PROJECT_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  aria-label={`Color ${c}`}
                  onClick={() => set('color', c)}
                  className={cx('h-5 w-5 rounded-full', draft.color === c && 'ring-2 ring-slate-900 ring-offset-1')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Team members</span>
          <div className="flex flex-wrap gap-2">
            {state.members.map((m) => {
              const on = draft.memberIds.includes(m.id)
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => toggleMember(m.id)}
                  className={cx(
                    'flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs ring-1 transition',
                    on ? 'bg-indigo-50 text-indigo-800 ring-indigo-300' : 'text-slate-600 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  <Avatar member={m} size="xs" />
                  {m.name.split(' ')[0]}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid}>
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
