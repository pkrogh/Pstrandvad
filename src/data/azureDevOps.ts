import type { Activity, AppData, Member, Milestone, Priority, Project, ProjectStatus, Task, TaskStatus } from '../types'
import { PROJECT_COLORS } from '../lib/meta'
import { addDays, isoFromToday, parseIso, toIso } from '../lib/dates'
import { projectProgress, timeElapsed } from '../lib/analytics'

/*
 * Loads Epics (→ projects), Features (→ milestones) and the leaf work items
 * beneath them (→ tasks) from Azure DevOps through the local /ado proxy.
 * The proxy adds the access token server-side; nothing secret lives here.
 */

const config = __ADO_CONFIG__
const API = 'api-version=7.1'
const project = encodeURIComponent(config.project)

type StateCategory = 'Proposed' | 'InProgress' | 'Resolved' | 'Completed' | 'Removed'

interface Identity {
  id?: string
  displayName: string
  uniqueName?: string
}

interface WorkItem {
  id: number
  fields: Record<string, unknown>
}

interface IterationNode {
  path: string
  attributes?: { startDate?: string; finishDate?: string }
  children?: IterationNode[]
}

export class AdoError extends Error {}

async function ado<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/ado${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const j = await res.json()
      if (j?.message) message = j.message
    } catch {
      // non-JSON error body
    }
    if (res.status === 401) message = 'The access token was rejected (401). Check that ADO_PAT is valid and has Work Items (Read) scope.'
    if (res.status === 404 && path.includes(project)) message = `Project “${config.project}” was not found (404). Check ADO_ORG and ADO_PROJECT.`
    throw new AdoError(message)
  }
  return res.json() as Promise<T>
}

const wiql = <T,>(query: string) => ado<T>(`/${project}/_apis/wit/wiql?${API}`, { query })

async function fetchWorkItems(ids: number[]): Promise<WorkItem[]> {
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200))
  const out: WorkItem[] = []
  // A few requests at a time to stay well within rate limits.
  for (let i = 0; i < chunks.length; i += 4) {
    const results = await Promise.all(
      chunks.slice(i, i + 4).map((c) => ado<{ value: WorkItem[] }>(`/${project}/_apis/wit/workitemsbatch?${API}`, { ids: c, errorPolicy: 'omit' })),
    )
    results.forEach((r) => out.push(...r.value.filter(Boolean)))
  }
  return out
}

// ---------- field helpers ----------

const str = (w: WorkItem, f: string) => (typeof w.fields[f] === 'string' ? (w.fields[f] as string) : '')
const num = (w: WorkItem, f: string) => (typeof w.fields[f] === 'number' ? (w.fields[f] as number) : 0)
const date = (w: WorkItem, f: string) => {
  const v = str(w, f)
  return v ? toIso(new Date(v)) : ''
}

function identity(v: unknown): Identity | null {
  if (!v) return null
  if (typeof v === 'object') {
    const o = v as Identity
    return o.displayName ? o : null
  }
  // Older API format: "Display Name <user@example.com>"
  const m = String(v).match(/^(.*?)\s*<(.+)>$/)
  return m ? { displayName: m[1], uniqueName: m[2] } : { displayName: String(v) }
}

const identityKey = (i: Identity) => i.id ?? i.uniqueName ?? i.displayName

function stripHtml(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+\n/g, '\n').trim()
}

function priority(p: number): Priority {
  return p === 1 ? 'urgent' : p === 2 ? 'high' : p === 4 ? 'low' : 'medium'
}

function initialsKey(title: string): string {
  const letters = title
    .split(/[\s\-_/]+/)
    .filter((w) => /^[a-z0-9]/i.test(w))
    .map((w) => w[0].toUpperCase())
    .join('')
  return (letters || 'EP').slice(0, 3)
}

/** "\Proj\Iteration\Sprint 1" (classification node) → "Proj\Sprint 1" (work item IterationPath). */
function normalizeIterationPath(nodePath: string): string {
  const parts = nodePath.replace(/^\\/, '').split('\\')
  if (parts[1]?.toLowerCase() === 'iteration') parts.splice(1, 1)
  return parts.join('\\')
}

function flattenIterations(node: IterationNode | undefined, out = new Map<string, { start: string; finish: string }>()) {
  if (!node) return out
  if (node.attributes?.startDate && node.attributes?.finishDate) {
    out.set(normalizeIterationPath(node.path), {
      start: toIso(new Date(node.attributes.startDate)),
      finish: toIso(new Date(node.attributes.finishDate)),
    })
  }
  node.children?.forEach((c) => flattenIterations(c, out))
  return out
}

const webUrl = (id: number) => `${config.webUrl}/${project}/_workitems/edit/${id}`

// ---------- main loader ----------

export async function loadFromAzureDevOps(): Promise<AppData> {
  const [epicsRes, treeRes, iterationsRes, connection] = await Promise.all([
    wiql<{ workItems: { id: number }[] }>(
      `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] = 'Epic' AND [System.State] <> 'Removed' ORDER BY [System.ChangedDate] DESC`,
    ),
    wiql<{ workItemRelations: { source: { id: number } | null; target: { id: number } }[] }>(
      `SELECT [System.Id] FROM WorkItemLinks WHERE ([Source].[System.TeamProject] = @project AND [Source].[System.WorkItemType] = 'Epic' AND [Source].[System.State] <> 'Removed') AND ([System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward') AND ([Target].[System.State] <> 'Removed') MODE (Recursive)`,
    ),
    ado<IterationNode>(`/${project}/_apis/wit/classificationnodes/iterations?$depth=10&${API}`).catch(() => undefined),
    ado<{ authenticatedUser?: { id?: string } }>(`/_apis/connectionData`).catch(() => ({ authenticatedUser: undefined })),
  ])

  const epicIds = new Set(epicsRes.workItems.map((w) => w.id))
  const parentOf = new Map<number, number>()
  const hasChildren = new Set<number>()
  for (const r of treeRes.workItemRelations ?? []) {
    if (r.source) {
      parentOf.set(r.target.id, r.source.id)
      hasChildren.add(r.source.id)
    }
  }
  const allIds = [...new Set([...epicIds, ...parentOf.keys(), ...parentOf.values()])]
  if (epicIds.size === 0) throw new AdoError(`No Epics found in “${config.project}”. Projects in this app are Epics — create one, or check ADO_PROJECT.`)

  const items = await fetchWorkItems(allIds)
  const byId = new Map(items.map((w) => [w.id, w]))
  const iterations = flattenIterations(iterationsRes)

  // State → category per work item type (category is consistent across processes; state names aren't).
  const types = [...new Set(items.map((w) => str(w, 'System.WorkItemType')))]
  const categories = new Map<string, StateCategory>()
  await Promise.all(
    types.map(async (t) => {
      try {
        const res = await ado<{ value: { name: string; category: StateCategory }[] }>(`/${project}/_apis/wit/workitemtypes/${encodeURIComponent(t)}/states?${API}`)
        res.value.forEach((s) => categories.set(`${t}|${s.name}`, s.category))
      } catch {
        // fall back to name-based guess below
      }
    }),
  )
  const categoryOf = (w: WorkItem): StateCategory => {
    const state = str(w, 'System.State')
    const known = categories.get(`${str(w, 'System.WorkItemType')}|${state}`)
    if (known) return known
    if (/^(closed|done|completed)$/i.test(state)) return 'Completed'
    if (/^(resolved)$/i.test(state)) return 'Resolved'
    if (/^(active|committed|in progress|doing)$/i.test(state)) return 'InProgress'
    if (/^removed$/i.test(state)) return 'Removed'
    return 'Proposed'
  }

  const rootEpic = (id: number): number | null => {
    let cur = id
    let epic: number | null = epicIds.has(id) ? id : null
    for (let guard = 0; parentOf.has(cur) && guard < 20; guard++) {
      cur = parentOf.get(cur)!
      if (epicIds.has(cur)) epic = cur
    }
    return epic
  }

  // ---------- members ----------
  const members = new Map<string, Member>()
  const memberAreas = new Map<string, string[]>()
  const ensureMember = (i: Identity | null, area?: string): string | null => {
    if (!i) return null
    const key = identityKey(i)
    if (!members.has(key)) {
      members.set(key, {
        id: key,
        name: i.displayName,
        role: i.uniqueName ?? 'Team member',
        team: '',
        capacity: config.defaultCapacity,
        color: PROJECT_COLORS[members.size % PROJECT_COLORS.length],
      })
    }
    if (area) memberAreas.set(key, [...(memberAreas.get(key) ?? []), area])
    return key
  }

  // ---------- tasks ----------
  const tasks: Task[] = []
  const today = isoFromToday(0)
  for (const w of items) {
    const type = str(w, 'System.WorkItemType')
    if (epicIds.has(w.id) || type === 'Epic' || type === 'Feature' || hasChildren.has(w.id)) continue
    const epic = rootEpic(w.id)
    const category = categoryOf(w)
    if (!epic || category === 'Removed') continue

    const iteration = iterations.get(str(w, 'System.IterationPath'))
    const status: TaskStatus =
      category === 'Completed' ? 'done' : category === 'Resolved' ? 'review' : category === 'InProgress' ? 'in_progress' : iteration ? 'todo' : 'backlog'

    const points = num(w, 'Microsoft.VSTS.Scheduling.StoryPoints') || num(w, 'Microsoft.VSTS.Scheduling.Effort') || num(w, 'Microsoft.VSTS.Scheduling.Size')
    const estimate =
      num(w, 'Microsoft.VSTS.Scheduling.OriginalEstimate') ||
      num(w, 'Microsoft.VSTS.Scheduling.RemainingWork') + num(w, 'Microsoft.VSTS.Scheduling.CompletedWork') ||
      points * config.hoursPerPoint

    const created = date(w, 'System.CreatedDate') || today
    const startDate = date(w, 'Microsoft.VSTS.Scheduling.StartDate') || iteration?.start || date(w, 'Microsoft.VSTS.Common.ActivatedDate') || created
    let dueDate =
      date(w, 'Microsoft.VSTS.Scheduling.TargetDate') ||
      date(w, 'Microsoft.VSTS.Scheduling.DueDate') ||
      date(w, 'Microsoft.VSTS.Scheduling.FinishDate') ||
      iteration?.finish ||
      date(byId.get(epic)!, 'Microsoft.VSTS.Scheduling.TargetDate') ||
      toIso(addDays(parseIso(startDate), 14))
    if (dueDate < startDate) dueDate = startDate

    const area = str(w, 'System.AreaPath').split('\\').pop()
    tasks.push({
      id: String(w.id),
      projectId: String(epic),
      title: str(w, 'System.Title'),
      description: stripHtml(str(w, 'System.Description') || str(w, 'Microsoft.VSTS.TCM.ReproSteps')),
      status,
      priority: priority(num(w, 'Microsoft.VSTS.Common.Priority')),
      assigneeId: ensureMember(identity(w.fields['System.AssignedTo']), area),
      estimate: Math.round(estimate * 10) / 10,
      startDate,
      dueDate,
      tags: str(w, 'System.Tags')
        .split(';')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      createdAt: created,
      completedAt: status === 'done' ? date(w, 'Microsoft.VSTS.Common.ClosedDate') || date(w, 'Microsoft.VSTS.Common.StateChangeDate') || today : null,
      url: webUrl(w.id),
      sourceType: type,
      sourceState: str(w, 'System.State'),
    })
  }

  // ---------- projects ----------
  const projects: Project[] = [...epicIds]
    .map((id) => byId.get(id))
    .filter((w): w is WorkItem => !!w)
    .map((w, i) => {
      const id = String(w.id)
      const pt = tasks.filter((t) => t.projectId === id)
      const category = categoryOf(w)
      const anyStarted = pt.some((t) => t.status !== 'backlog' && t.status !== 'todo')
      const status: ProjectStatus =
        category === 'Completed' ? 'completed' : category === 'InProgress' || category === 'Resolved' || anyStarted ? 'active' : 'planning'

      const starts = pt.map((t) => t.startDate).sort()
      const dues = pt.map((t) => t.dueDate).sort()
      const startDate = date(w, 'Microsoft.VSTS.Scheduling.StartDate') || starts[0] || date(w, 'System.CreatedDate') || today
      let dueDate = date(w, 'Microsoft.VSTS.Scheduling.TargetDate') || dues[dues.length - 1] || toIso(addDays(parseIso(startDate), 90))
      if (dueDate < startDate) dueDate = startDate

      const features = items.filter((f) => str(f, 'System.WorkItemType') === 'Feature' && rootEpic(f.id) === w.id)
      const milestones: Milestone[] = features.map((f) => {
        const childDues = tasks.filter((t) => isDescendant(Number(t.id), f.id, parentOf)).map((t) => t.dueDate).sort()
        return {
          id: String(f.id),
          name: str(f, 'System.Title'),
          date: date(f, 'Microsoft.VSTS.Scheduling.TargetDate') || childDues[childDues.length - 1] || dueDate,
          done: categoryOf(f) === 'Completed',
        }
      })

      const ownerId = ensureMember(identity(w.fields['System.AssignedTo'])) ?? pt.find((t) => t.assigneeId)?.assigneeId ?? ''
      const draft: Project = {
        id,
        key: initialsKey(str(w, 'System.Title')),
        name: str(w, 'System.Title'),
        client: str(w, 'System.AreaPath').split('\\').pop() || config.project,
        description: stripHtml(str(w, 'System.Description')),
        status,
        health: 'on_track',
        ownerId,
        memberIds: [...new Set(pt.map((t) => t.assigneeId).filter((x): x is string => !!x))],
        startDate,
        dueDate,
        budget: 0,
        spent: 0,
        color: PROJECT_COLORS[i % PROJECT_COLORS.length],
        milestones,
        url: webUrl(w.id),
      }
      return { ...draft, health: deriveHealth(draft, pt) }
    })

  // Team = most common area of the person's work.
  for (const [key, areas] of memberAreas) {
    const counts = new Map<string, number>()
    areas.forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1))
    members.get(key)!.team = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? config.project
  }
  for (const m of members.values()) if (!m.team) m.team = config.project

  // ---------- activity (most recently changed items) ----------
  const activity: Activity[] = items
    .filter((w) => rootEpic(w.id) !== null && str(w, 'System.ChangedDate'))
    .sort((a, b) => str(b, 'System.ChangedDate').localeCompare(str(a, 'System.ChangedDate')))
    .slice(0, 20)
    .map((w) => {
      const who = identity(w.fields['System.ChangedBy'])
      const key = who ? identityKey(who) : ''
      return {
        id: `a${w.id}`,
        at: new Date(str(w, 'System.ChangedDate')).toISOString(),
        actorId: members.has(key) ? key : '',
        actorName: who?.displayName ?? 'Someone',
        projectId: String(rootEpic(w.id)),
        text: `updated ${str(w, 'System.WorkItemType').toLowerCase()} “${str(w, 'System.Title')}” · ${str(w, 'System.State')}`,
      }
    })

  const me = connection.authenticatedUser?.id
  return {
    members: [...members.values()].sort((a, b) => a.name.localeCompare(b.name)),
    projects,
    tasks,
    activity,
    currentUserId: me && members.has(me) ? me : undefined,
  }
}

function isDescendant(id: number, ancestor: number, parentOf: Map<number, number>): boolean {
  let cur = id
  for (let guard = 0; parentOf.has(cur) && guard < 20; guard++) {
    cur = parentOf.get(cur)!
    if (cur === ancestor) return true
  }
  return false
}

/** Azure DevOps has no project-health field, so derive one from schedule vs. progress. */
function deriveHealth(p: Project, tasks: Task[]): Project['health'] {
  if (p.status === 'completed') return 'on_track'
  const progress = projectProgress(tasks)
  const elapsed = timeElapsed(p)
  const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.dueDate < isoFromToday(0)).length
  if ((elapsed >= 100 && progress < 100) || progress < elapsed - 30) return 'off_track'
  if (progress < elapsed - 15 || overdueTasks > Math.max(2, tasks.length * 0.15)) return 'at_risk'
  return 'on_track'
}
