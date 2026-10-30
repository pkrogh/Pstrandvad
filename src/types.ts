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
}

export interface Activity {
  id: string
  at: string
  actorId: string
  projectId: string
  text: string
}

export interface AppData {
  members: Member[]
  projects: Project[]
  tasks: Task[]
  activity: Activity[]
}
