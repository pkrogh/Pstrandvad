export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed'
export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track'
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Member {
  id: string
  name: string
  role: string
  team: string
  /** Available hours per week */
  capacity: number
  color: string
}

export interface Milestone {
  id: string
  name: string
  date: string
  done: boolean
}

export interface Project {
  id: string
  key: string
  name: string
  client: string
  description: string
  status: ProjectStatus
  health: ProjectHealth
  ownerId: string
  memberIds: string[]
  startDate: string
  dueDate: string
  budget: number
  spent: number
  color: string
  milestones: Milestone[]
  /** Link to the source item (e.g. the Azure DevOps epic) */
  url?: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  assigneeId: string | null
  /** Estimated effort in hours */
  estimate: number
  startDate: string
  dueDate: string
  tags: string[]
  createdAt: string
  completedAt: string | null
  /** Link to the source item (e.g. the Azure DevOps work item) */
  url?: string
  /** Original work item type / state, when loaded from Azure DevOps */
  sourceType?: string
  sourceState?: string
}

export interface Activity {
  id: string
  at: string
  actorId: string
  projectId: string
  text: string
  /** Display name when the actor is not a team member */
  actorName?: string
}

export interface AppData {
  members: Member[]
  projects: Project[]
  tasks: Task[]
  activity: Activity[]
  /** Member the app treats as "me" */
  currentUserId?: string
}
