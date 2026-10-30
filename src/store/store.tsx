import { createContext, useCallback, useContext, useEffect, useReducer, useState, type ReactNode } from 'react'
import type { Activity, AppData, Project, Task, TaskStatus } from '../types'
import { createMockData } from '../data/mockData'
import { loadFromAzureDevOps } from '../data/azureDevOps'
import { isoFromToday } from '../lib/dates'
import { STATUS_LABEL } from '../lib/meta'

const STORAGE_KEY = 'strandvad-pm:v1'
const ADO = __ADO_CONFIG__

export type Action =
  | { type: 'task/create'; task: Omit<Task, 'id' | 'createdAt' | 'completedAt'> }
  | { type: 'task/update'; id: string; patch: Partial<Task> }
  | { type: 'task/move'; id: string; status: TaskStatus; beforeId?: string | null }
  | { type: 'task/delete'; id: string }
  | { type: 'project/create'; project: Omit<Project, 'id'> }
  | { type: 'project/update'; id: string; patch: Partial<Project> }
  | { type: 'milestone/toggle'; projectId: string; milestoneId: string }
  | { type: 'reset' }
  | { type: 'load'; data: AppData }

let counter = Date.now()
const uid = (prefix: string) => `${prefix}${(counter++).toString(36)}`

function log(state: AppData, projectId: string, text: string): Activity[] {
  const entry: Activity = { id: uid('a'), at: new Date().toISOString(), actorId: state.currentUserId ?? '', projectId, text }
  return [entry, ...state.activity].slice(0, 50)
}

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'task/create': {
      const task: Task = {
        ...action.task,
        id: uid('t'),
        createdAt: isoFromToday(0),
        completedAt: action.task.status === 'done' ? isoFromToday(0) : null,
      }
      return { ...state, tasks: [...state.tasks, task], activity: log(state, task.projectId, `created “${task.title}”`) }
    }
    case 'task/update': {
      const prev = state.tasks.find((t) => t.id === action.id)
      if (!prev) return state
      const next = withCompletion({ ...prev, ...action.patch }, prev)
      const tasks = state.tasks.map((t) => (t.id === action.id ? next : t))
      const activity =
        action.patch.status && action.patch.status !== prev.status
          ? log(state, prev.projectId, `moved “${prev.title}” to ${STATUS_LABEL[action.patch.status]}`)
          : state.activity
      return { ...state, tasks, activity }
    }
    case 'task/move': {
      const prev = state.tasks.find((t) => t.id === action.id)
      if (!prev) return state
      const moved = withCompletion({ ...prev, status: action.status }, prev)
      const rest = state.tasks.filter((t) => t.id !== action.id)
      const idx = action.beforeId ? rest.findIndex((t) => t.id === action.beforeId) : -1
      const tasks = idx === -1 ? [...rest, moved] : [...rest.slice(0, idx), moved, ...rest.slice(idx)]
      const activity =
        prev.status !== action.status
          ? log(state, prev.projectId, `moved “${prev.title}” to ${STATUS_LABEL[action.status]}`)
          : state.activity
      return { ...state, tasks, activity }
    }
    case 'task/delete': {
      const prev = state.tasks.find((t) => t.id === action.id)
      if (!prev) return state
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        activity: log(state, prev.projectId, `deleted “${prev.title}”`),
      }
    }
    case 'project/create': {
      const project: Project = { ...action.project, id: uid('p') }
      return { ...state, projects: [...state.projects, project], activity: log(state, project.id, `created project ${project.name}`) }
    }
    case 'project/update': {
      return { ...state, projects: state.projects.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) }
    }
    case 'milestone/toggle':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id !== action.projectId
            ? p
            : { ...p, milestones: p.milestones.map((m) => (m.id === action.milestoneId ? { ...m, done: !m.done } : m)) },
        ),
      }
    case 'reset':
      return createMockData()
    case 'load':
      return action.data
  }
}

function withCompletion(next: Task, prev: Task): Task {
  if (next.status === 'done' && prev.status !== 'done') return { ...next, completedAt: isoFromToday(0) }
  if (next.status !== 'done' && prev.status === 'done') return { ...next, completedAt: null }
  return next
}

function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AppData
  } catch {
    // ignore corrupt/unavailable storage
  }
  return createMockData()
}

const EMPTY: AppData = { members: [], projects: [], tasks: [], activity: [] }

export interface SyncState {
  /** Where the data comes from: Azure DevOps (when configured) or local demo data. */
  source: 'ado' | 'mock'
  status: 'loading' | 'ready' | 'error'
  error?: string
  lastSync?: Date
}

interface StoreValue {
  state: AppData
  dispatch: React.Dispatch<Action>
  sync: SyncState
  refresh: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => (ADO.enabled ? EMPTY : loadLocal()))
  const [sync, setSync] = useState<SyncState>(ADO.enabled ? { source: 'ado', status: 'loading' } : { source: 'mock', status: 'ready' })

  const refresh = useCallback(() => {
    if (!ADO.enabled) return
    setSync((s) => ({ ...s, source: 'ado', status: 'loading', error: undefined }))
    loadFromAzureDevOps()
      .then((data) => {
        dispatch({ type: 'load', data })
        setSync({ source: 'ado', status: 'ready', lastSync: new Date() })
      })
      .catch((e: Error) => {
        // Keep the app usable: fall back to demo data and explain why.
        dispatch({ type: 'load', data: loadLocal() })
        setSync({ source: 'mock', status: 'error', error: e.message })
      })
  }, [])

  useEffect(refresh, [refresh])

  useEffect(() => {
    // Only demo data is persisted; Azure DevOps data is always re-fetched so it's never stale.
    if (sync.source !== 'mock') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage full or blocked — state still works in memory
    }
  }, [state, sync.source])

  return <StoreContext.Provider value={{ state, dispatch, sync, refresh }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
