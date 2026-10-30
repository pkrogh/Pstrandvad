import type { Activity, AppData, Member, Priority, Project, Task, TaskStatus } from '../types'
import { isoFromToday } from '../lib/dates'

// Deterministic PRNG so the mock data is stable between reloads/resets.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const members: Member[] = [
  { id: 'm1', name: 'Sofie Andersen', role: 'Engineering Manager', team: 'Engineering', capacity: 32, color: '#4f46e5' },
  { id: 'm2', name: 'Mikkel Jensen', role: 'Senior Frontend Engineer', team: 'Engineering', capacity: 40, color: '#0891b2' },
  { id: 'm3', name: 'Amara Okafor', role: 'Backend Engineer', team: 'Engineering', capacity: 40, color: '#059669' },
  { id: 'm4', name: 'Lucas Petersen', role: 'Full-stack Engineer', team: 'Engineering', capacity: 40, color: '#d97706' },
  { id: 'm5', name: 'Priya Raman', role: 'DevOps Engineer', team: 'Engineering', capacity: 36, color: '#dc2626' },
  { id: 'm6', name: 'Emma Nielsen', role: 'Product Designer', team: 'Design', capacity: 40, color: '#db2777' },
  { id: 'm7', name: 'Jonas Larsen', role: 'UX Researcher', team: 'Design', capacity: 30, color: '#9333ea' },
  { id: 'm8', name: 'Clara Holm', role: 'Product Manager', team: 'Product', capacity: 40, color: '#2563eb' },
  { id: 'm9', name: 'Oliver Madsen', role: 'Product Manager', team: 'Product', capacity: 40, color: '#65a30d' },
  { id: 'm10', name: 'Freja Kristensen', role: 'QA Engineer', team: 'Engineering', capacity: 40, color: '#0d9488' },
  { id: 'm11', name: 'Noah Schmidt', role: 'Data Analyst', team: 'Data', capacity: 24, color: '#ea580c' },
  { id: 'm12', name: 'Ida Mortensen', role: 'Content Strategist', team: 'Marketing', capacity: 32, color: '#7c3aed' },
]

export const projects: Project[] = [
  {
    id: 'p1', key: 'WEB', name: 'Website Relaunch', client: 'Nordlys Energi',
    description: 'Full redesign and re-platforming of the corporate website onto a headless CMS, with a new design system and improved accessibility.',
    status: 'active', health: 'on_track', ownerId: 'm8', memberIds: ['m2', 'm4', 'm6', 'm10', 'm12'],
    startDate: isoFromToday(-62), dueDate: isoFromToday(38), budget: 180000, spent: 104500, color: '#4f46e5',
    milestones: [
      { id: 'ms1', name: 'Design system v1', date: isoFromToday(-30), done: true },
      { id: 'ms2', name: 'CMS migration', date: isoFromToday(9), done: false },
      { id: 'ms3', name: 'Public launch', date: isoFromToday(38), done: false },
    ],
  },
  {
    id: 'p2', key: 'MOB', name: 'Mobile App 2.0', client: 'Internal',
    description: 'Second major version of the customer mobile app: offline mode, push notifications and a rebuilt onboarding flow.',
    status: 'active', health: 'at_risk', ownerId: 'm9', memberIds: ['m2', 'm3', 'm6', 'm7', 'm10'],
    startDate: isoFromToday(-90), dueDate: isoFromToday(24), budget: 260000, spent: 211000, color: '#0891b2',
    milestones: [
      { id: 'ms4', name: 'Beta to TestFlight', date: isoFromToday(-12), done: true },
      { id: 'ms5', name: 'Offline sync complete', date: isoFromToday(4), done: false },
      { id: 'ms6', name: 'Store release', date: isoFromToday(24), done: false },
    ],
  },
  {
    id: 'p3', key: 'DAT', name: 'Data Platform Migration', client: 'Internal',
    description: 'Move analytics pipelines from the legacy warehouse to a modern lakehouse, including dbt models and self-serve dashboards.',
    status: 'active', health: 'off_track', ownerId: 'm1', memberIds: ['m3', 'm5', 'm11'],
    startDate: isoFromToday(-120), dueDate: isoFromToday(10), budget: 140000, spent: 151200, color: '#059669',
    milestones: [
      { id: 'ms7', name: 'Ingestion layer', date: isoFromToday(-40), done: true },
      { id: 'ms8', name: 'dbt models ported', date: isoFromToday(-5), done: false },
      { id: 'ms9', name: 'Legacy shutdown', date: isoFromToday(10), done: false },
    ],
  },
  {
    id: 'p4', key: 'CRM', name: 'CRM Integration', client: 'Havblik Logistics',
    description: 'Two-way sync between the order platform and the client CRM, with lead scoring and automated follow-ups.',
    status: 'planning', health: 'on_track', ownerId: 'm8', memberIds: ['m4', 'm3', 'm7', 'm11'],
    startDate: isoFromToday(7), dueDate: isoFromToday(95), budget: 95000, spent: 6200, color: '#d97706',
    milestones: [
      { id: 'ms10', name: 'Discovery complete', date: isoFromToday(14), done: false },
      { id: 'ms11', name: 'Sync MVP', date: isoFromToday(55), done: false },
    ],
  },
  {
    id: 'p5', key: 'SEC', name: 'Security Compliance (ISO 27001)', client: 'Internal',
    description: 'Prepare controls, documentation and tooling for the ISO 27001 certification audit.',
    status: 'on_hold', health: 'at_risk', ownerId: 'm1', memberIds: ['m5', 'm10', 'm12'],
    startDate: isoFromToday(-45), dueDate: isoFromToday(70), budget: 60000, spent: 18400, color: '#dc2626',
    milestones: [
      { id: 'ms12', name: 'Gap analysis', date: isoFromToday(-20), done: true },
      { id: 'ms13', name: 'Internal audit', date: isoFromToday(45), done: false },
    ],
  },
  {
    id: 'p6', key: 'BRD', name: 'Brand Refresh', client: 'Nordlys Energi',
    description: 'Updated visual identity, tone of voice guidelines and marketing templates.',
    status: 'completed', health: 'on_track', ownerId: 'm9', memberIds: ['m6', 'm7', 'm12'],
    startDate: isoFromToday(-150), dueDate: isoFromToday(-21), budget: 70000, spent: 66300, color: '#db2777',
    milestones: [
      { id: 'ms14', name: 'Identity approved', date: isoFromToday(-70), done: true },
      { id: 'ms15', name: 'Guidelines published', date: isoFromToday(-21), done: true },
    ],
  },
]

interface Seed {
  title: string
  tags: string[]
  estimate: number
  role?: 'eng' | 'fe' | 'be' | 'design' | 'qa' | 'pm' | 'data' | 'ops' | 'content'
}

const taskSeeds: Record<string, Seed[]> = {
  p1: [
    { title: 'Audit existing page templates', tags: ['research'], estimate: 8, role: 'design' },
    { title: 'Build navigation mega-menu component', tags: ['frontend'], estimate: 12, role: 'fe' },
    { title: 'Set up headless CMS content models', tags: ['cms'], estimate: 16, role: 'eng' },
    { title: 'Migrate 140 news articles', tags: ['cms', 'content'], estimate: 20, role: 'content' },
    { title: 'Design case-study page layout', tags: ['design'], estimate: 10, role: 'design' },
    { title: 'Implement responsive image pipeline', tags: ['frontend', 'performance'], estimate: 8, role: 'fe' },
    { title: 'WCAG 2.1 AA accessibility pass', tags: ['a11y'], estimate: 14, role: 'qa' },
    { title: 'Write SEO redirect map', tags: ['seo'], estimate: 6, role: 'content' },
    { title: 'Contact form with CRM webhook', tags: ['frontend', 'integration'], estimate: 6, role: 'eng' },
    { title: 'Cookie consent banner', tags: ['legal', 'frontend'], estimate: 4, role: 'fe' },
    { title: 'Cross-browser regression suite', tags: ['qa'], estimate: 10, role: 'qa' },
    { title: 'Lighthouse performance budget in CI', tags: ['performance'], estimate: 5, role: 'eng' },
    { title: 'Homepage hero animation', tags: ['design', 'frontend'], estimate: 6, role: 'fe' },
    { title: 'Stakeholder content review round 2', tags: ['content'], estimate: 4, role: 'pm' },
    { title: 'Search results page', tags: ['frontend'], estimate: 9, role: 'fe' },
  ],
  p2: [
    { title: 'Offline sync conflict resolution', tags: ['backend', 'offline'], estimate: 20, role: 'be' },
    { title: 'Local SQLite schema migrations', tags: ['offline'], estimate: 10, role: 'fe' },
    { title: 'Push notification service', tags: ['backend'], estimate: 14, role: 'be' },
    { title: 'Notification preferences screen', tags: ['frontend'], estimate: 6, role: 'fe' },
    { title: 'Redesign onboarding flow', tags: ['design'], estimate: 16, role: 'design' },
    { title: 'Usability test onboarding (5 users)', tags: ['research'], estimate: 12, role: 'design' },
    { title: 'Fix crash on Android 12 camera upload', tags: ['bug'], estimate: 5, role: 'fe' },
    { title: 'Deep-link routing', tags: ['frontend'], estimate: 8, role: 'fe' },
    { title: 'App store screenshots & copy', tags: ['marketing'], estimate: 6, role: 'design' },
    { title: 'E2E tests with Detox', tags: ['qa'], estimate: 16, role: 'qa' },
    { title: 'Rate limiting on sync API', tags: ['backend', 'security'], estimate: 6, role: 'be' },
    { title: 'Biometric login', tags: ['security'], estimate: 8, role: 'fe' },
    { title: 'Dark mode support', tags: ['design', 'frontend'], estimate: 10, role: 'fe' },
    { title: 'Release checklist & rollback plan', tags: ['release'], estimate: 3, role: 'pm' },
    { title: 'Analytics event taxonomy', tags: ['analytics'], estimate: 5, role: 'pm' },
    { title: 'Memory leak in image cache', tags: ['bug', 'performance'], estimate: 7, role: 'fe' },
  ],
  p3: [
    { title: 'Port revenue dbt models', tags: ['dbt'], estimate: 18, role: 'data' },
    { title: 'Port customer dimension models', tags: ['dbt'], estimate: 12, role: 'data' },
    { title: 'Terraform for lakehouse workspace', tags: ['infra'], estimate: 10, role: 'ops' },
    { title: 'Kafka → lake ingestion job', tags: ['pipeline'], estimate: 16, role: 'be' },
    { title: 'Data quality tests (Great Expectations)', tags: ['quality'], estimate: 12, role: 'data' },
    { title: 'Backfill 3 years of order history', tags: ['pipeline'], estimate: 14, role: 'be' },
    { title: 'Cost monitoring alerts', tags: ['infra'], estimate: 4, role: 'ops' },
    { title: 'Rebuild executive KPI dashboard', tags: ['bi'], estimate: 10, role: 'data' },
    { title: 'Access control & PII masking', tags: ['security'], estimate: 8, role: 'ops' },
    { title: 'Legacy warehouse decommission plan', tags: ['planning'], estimate: 4, role: 'pm' },
    { title: 'Reconcile finance numbers old vs new', tags: ['quality'], estimate: 10, role: 'data' },
  ],
  p4: [
    { title: 'Stakeholder interviews (sales team)', tags: ['research'], estimate: 8, role: 'design' },
    { title: 'Map CRM field schema', tags: ['integration'], estimate: 6, role: 'be' },
    { title: 'OAuth app registration', tags: ['integration', 'security'], estimate: 3, role: 'eng' },
    { title: 'Lead scoring model prototype', tags: ['data'], estimate: 12, role: 'data' },
    { title: 'Sync architecture RFC', tags: ['architecture'], estimate: 6, role: 'be' },
    { title: 'Define success metrics', tags: ['planning'], estimate: 3, role: 'pm' },
    { title: 'Webhook retry queue', tags: ['backend'], estimate: 10, role: 'be' },
  ],
  p5: [
    { title: 'Asset inventory', tags: ['compliance'], estimate: 8, role: 'ops' },
    { title: 'Write access control policy', tags: ['policy'], estimate: 6, role: 'content' },
    { title: 'Enable SSO on all SaaS tools', tags: ['security'], estimate: 10, role: 'ops' },
    { title: 'Vendor risk questionnaire', tags: ['compliance'], estimate: 5, role: 'content' },
    { title: 'Penetration test remediation', tags: ['security'], estimate: 16, role: 'qa' },
    { title: 'Incident response runbook', tags: ['policy'], estimate: 6, role: 'ops' },
  ],
  p6: [
    { title: 'Logo exploration', tags: ['design'], estimate: 16, role: 'design' },
    { title: 'Tone of voice guide', tags: ['content'], estimate: 10, role: 'content' },
    { title: 'Slide deck template', tags: ['design'], estimate: 6, role: 'design' },
    { title: 'Brand perception survey', tags: ['research'], estimate: 8, role: 'design' },
    { title: 'Social media templates', tags: ['design', 'marketing'], estimate: 6, role: 'design' },
  ],
}

const roleToMembers: Record<NonNullable<Seed['role']>, string[]> = {
  eng: ['m4', 'm2', 'm3'],
  fe: ['m2', 'm4'],
  be: ['m3', 'm4'],
  design: ['m6', 'm7'],
  qa: ['m10'],
  pm: ['m8', 'm9', 'm1'],
  data: ['m11', 'm3'],
  ops: ['m5'],
  content: ['m12'],
}

const descriptions = [
  'Acceptance criteria are listed in the linked spec. Coordinate with the project owner before changing scope.',
  'Blocked on input from the client last week — now unblocked. Keep changes behind a feature flag.',
  'Pair with design on the edge cases. Add screenshots to the PR.',
  'Timebox this; if it grows beyond the estimate, flag it in stand-up.',
  'Follow the conventions in the team handbook. Include tests.',
]

function buildTasks(): Task[] {
  const rand = mulberry32(42)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const tasks: Task[] = []
  let n = 1

  for (const project of projects) {
    const seeds = taskSeeds[project.id]
    const progressBias =
      project.status === 'completed' ? 1 : project.status === 'planning' ? 0.05 : project.id === 'p3' ? 0.45 : 0.5

    seeds.forEach((seed, i) => {
      const r = rand()
      let status: TaskStatus
      if (project.status === 'completed') status = 'done'
      else if (project.status === 'planning') status = r < 0.6 ? 'backlog' : r < 0.9 ? 'todo' : 'in_progress'
      else if (r < progressBias * 0.75) status = 'done'
      else if (r < progressBias * 0.75 + 0.12) status = 'review'
      else if (r < progressBias * 0.75 + 0.32) status = 'in_progress'
      else if (r < progressBias * 0.75 + 0.5) status = 'todo'
      else status = 'backlog'

      const pr = rand()
      const priority: Priority = pr < 0.12 ? 'urgent' : pr < 0.38 ? 'high' : pr < 0.8 ? 'medium' : 'low'

      const candidates = roleToMembers[seed.role ?? 'eng'].filter(
        (m) => project.memberIds.includes(m) || project.ownerId === m,
      )
      const assigneeId = status === 'backlog' && rand() < 0.4 ? null : candidates.length ? pick(candidates) : pick(project.memberIds)

      // Spread due dates across the project timeline, nudging some into the past to create overdue items.
      const startOffset = Math.max(daysFromIso(project.startDate), -60)
      const endOffset = daysFromIso(project.dueDate)
      const span = endOffset - startOffset
      const pos = (i + 0.5) / seeds.length
      let dueOffset = Math.round(startOffset + span * pos + (rand() - 0.5) * 6)
      // Keep a handful of open tasks slightly overdue; push the rest into the coming weeks.
      if (status !== 'done' && dueOffset < -1) dueOffset = rand() < 0.25 ? -Math.round(1 + rand() * 9) : Math.round(2 + rand() * 24)
      const estimate = Math.round(seed.estimate * 2.5)
      const duration = Math.max(5, Math.round(estimate / 3))
      const startOffsetTask = dueOffset - duration
      const createdOffset = startOffsetTask - Math.round(rand() * 10) - 2

      tasks.push({
        id: `t${n}`,
        projectId: project.id,
        title: seed.title,
        description: pick(descriptions),
        status,
        priority,
        assigneeId,
        estimate,
        startDate: isoFromToday(startOffsetTask),
        dueDate: isoFromToday(dueOffset),
        tags: seed.tags,
        createdAt: isoFromToday(createdOffset),
        completedAt: status === 'done' ? isoFromToday(completedOffset(dueOffset, rand)) : null,
      })
      n++
    })
  }
  return tasks
}

/** Completed close to the due date, or spread over the last few weeks if it was finished early. */
function completedOffset(dueOffset: number, rand: () => number): number {
  const c = dueOffset + Math.round((rand() - 0.6) * 4)
  return c <= -1 ? c : -1 - Math.floor(rand() * 35)
}

function daysFromIso(iso: string): number {
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round((new Date(y, m - 1, d, 12).getTime() - now.getTime()) / 86400000)
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString()
}

const activity: Activity[] = [
  { id: 'a1', at: hoursAgo(0.4), actorId: 'm2', projectId: 'p2', text: 'moved “Deep-link routing” to Review' },
  { id: 'a2', at: hoursAgo(1.5), actorId: 'm11', projectId: 'p3', text: 'flagged “Reconcile finance numbers” as blocked by missing ledger export' },
  { id: 'a3', at: hoursAgo(3), actorId: 'm6', projectId: 'p1', text: 'uploaded new case-study layouts for review' },
  { id: 'a4', at: hoursAgo(5), actorId: 'm8', projectId: 'p4', text: 'scheduled the discovery kickoff with Havblik Logistics' },
  { id: 'a5', at: hoursAgo(9), actorId: 'm10', projectId: 'p2', text: 'reported 3 regressions from the latest beta build' },
  { id: 'a6', at: hoursAgo(22), actorId: 'm1', projectId: 'p3', text: 'changed project health to Off track' },
  { id: 'a7', at: hoursAgo(27), actorId: 'm5', projectId: 'p5', text: 'paused the project pending budget approval' },
  { id: 'a8', at: hoursAgo(49), actorId: 'm12', projectId: 'p1', text: 'completed migration of 60 / 140 news articles' },
]

export function createMockData(): AppData {
  return {
    members,
    projects: structuredClone(projects),
    tasks: buildTasks(),
    activity: structuredClone(activity),
    currentUserId: 'm8',
  }
}
