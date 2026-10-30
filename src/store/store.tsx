import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'
import type { Activity, AppData, Project, Task, TaskStatus } from '../types'
import { createMockData } from '../data/mockData'
import { isoFromToday } from '../lib/dates'
import { STATUS_LABEL } from '../lib/meta'

const STORAGE_KEY = 'strandvad-pm:v1'
/** The prototype has no auth; actions are attributed to this member. */
export const CURRENT_USER_ID = 'm8'

export type Action =
  | { type: 'task/create'; task: Omit<Task, 'id' | 'createdAt' | 'completedAt'> }
  | { type: 'task/update'; id: string; patch: Partial<Task> }
  | { type: 'task/move'; id: string; status: TaskStatus; beforeId?: string | null }
  | { type: 'task/delete'; id: string }
  | { type: 'project/create'; project: Omit<Project, 'id'> }
  | { type: 'project/update'; id: string; patch: Partial<Project> }
  | { type: 'milestone/toggle'; projectId: string; milestoneId: string }
  | { type: 'reset' }

let counter = Date.now()
const uid = (prefix: string) => `${prefix}${(counter++).toString(36)}`

function log(state: AppData, projectId: string, text: string): Activity[] {
  const entry: Activity = { id: uid('a'), at: new Date().toISOString(), actorId: CURRENT_USER_ID, projectId, text }
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
  }
}

function withCompletion(next: Task, prev: Task): Task {
  if (next.status === 'done' && prev.status !== 'done') return { ...next, completedAt: isoFromToday(0) }
  if (next.status !== 'done' && prev.status === 'done') return { ...next, completedAt: null }
  return next
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AppData
  } catch {
    // ignore corrupt/unavailable storage
  }
  return createMockData()
}

const StoreContext = createContext<{ state: AppData; dispatch: React.Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage full or blocked — state still works in memory
    }
  }, [state])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
