# Strandvad PM

A functional prototype of a modern project management app, built with **React 19, TypeScript, Vite and Tailwind CSS v4**.
There's no backend or authentication. All data is realistic mock data, generated relative to today's date and saved in your browser's `localStorage`.

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run build`     | Type-checks (`tsc -b`) and builds to `dist/`        |
| `npm run preview`   | Serves the production build locally                 |
| `npm run typecheck` | Type-check only                                     |

## Features

- **Dashboard**: KPI tiles (open projects, open/overdue tasks, team utilization), project health with progress vs. elapsed time, tasks completed per week, tasks due soon or overdue, this week's workload, and recent activity.
- **Projects**: filter by status, search, and create projects (name, key, client, dates, budget, owner, team, colour).
- **Project overview** (`/projects/:id`): progress, timeline, budget burn, task breakdown, a sortable task table, milestones you can toggle, and the team with each person's current load. Edit status, health or details inline.
- **Task board** (`/board`): a Kanban board with drag-and-drop between columns and reordering within a column. Each column has a quick add. Click a card to open the full editor (status, priority, assignee, estimate, dates, tags), or delete it. Filters for project, assignee, priority, overdue and free text are kept in the URL, so filtered views can be shared, e.g. `/board?project=p2&priority=high`.
- **Resources** (`/resources`): a person × week heatmap of planned hours against capacity, with a 4/8/12-week horizon, week navigation and a team filter. Hover a cell to see the per-project breakdown. Click a person to see their tasks and reassign them. An unassigned-work list suggests owners and shows each person's load.

Planned hours come from open task estimates spread evenly across each task's start-to-due window. Tasks in progress count 60% of their estimate as remaining work, and tasks in review count 25%. Work that should already be finished is pulled into the current week.

Use **Reset demo data** in the sidebar to restore the original data set.

## Connecting to Azure DevOps (read-only)

The app can load real data from Azure DevOps instead of the demo data.

1. Create a [personal access token](https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate) with the scopes **Work Items (Read)** and **Project and Team (Read)**.
2. Copy `.env.example` to `.env.local`. This file is git-ignored. Fill in `ADO_ORG`, `ADO_PROJECT` and `ADO_PAT`.
3. Restart `npm run dev`. The sidebar shows "Azure DevOps · *project*", with a **Refresh** button.

**How data is mapped**

| App | Azure DevOps |
| --- | --- |
| Project | **Epic** (title, description, Assigned To = owner, Start/Target Date) |
| Milestone | **Feature** under the epic (Target Date; done when Closed/Completed) |
| Task | **Leaf work items** under the epic: Tasks, or Stories/PBIs/Bugs that have no child tasks, so effort isn't counted twice |
| Status column | The state's *category*: Proposed → Backlog, or To do if in a sprint; In Progress → In progress; Resolved → Review; Completed → Done |
| Estimate | Original Estimate → Remaining + Completed Work → Story Points/Effort/Size × `ADO_HOURS_PER_POINT` |
| Dates | Start/Target/Due Date → sprint (iteration) dates → epic target date |
| Priority | 1 Urgent · 2 High · 3 Medium · 4 Low |
| People | Everyone assigned to work. Capacity = `ADO_DEFAULT_CAPACITY` h/week; team = most common Area Path |
| Health | Derived from progress vs. time elapsed and overdue work. Azure DevOps has no health field. |

Budgets aren't tracked in Azure DevOps, so the budget panels show "—" or are replaced by a milestone count.

**Security:** the token stays in the Vite dev/preview server (`server/adoProxy.ts`), which adds it to requests sent to Azure DevOps. The browser never receives it, and it isn't part of the build output. The proxy only forwards same-origin requests to a short list of read-only endpoints, so other websites can't use it and it can't change anything. It only runs with `npm run dev` / `npm run preview`. A hosted deployment needs a small backend, such as an Azure Function, to hold the token instead.

**Limitations of this first version:** sync is read-only. Edits in the app are kept only in the current tab and are lost on refresh. Sprint capacity from Azure DevOps team settings is not imported yet.

## Project structure

```
src/
  types.ts              Domain model (Project, Task, Member, …)
  data/mockData.ts      Deterministic mock data generator
  data/azureDevOps.ts   Azure DevOps loader (Epics → projects, Features → milestones, work items → tasks)
  store/store.tsx       React context + reducer; demo data persisted to localStorage
server/adoProxy.ts      Dev-server proxy that adds the Azure DevOps token server-side
  lib/                  Date helpers, analytics (progress, allocation), labels/colours
  components/           Layout, shared UI primitives, Task/Project dialogs
  pages/                Dashboard, Projects, ProjectDetail, Board, Resources
```

All state changes go through the reducer in `store/store.tsx`. To add a real backend later, replace that reducer with API calls; the pages don't need to change.
