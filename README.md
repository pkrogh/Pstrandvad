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

## Project structure

```
src/
  types.ts              Domain model (Project, Task, Member, …)
  data/mockData.ts      Deterministic mock data generator
  store/store.tsx       React context + reducer, persisted to localStorage
  lib/                  Date helpers, analytics (progress, allocation), labels/colours
  components/           Layout, shared UI primitives, Task/Project dialogs
  pages/                Dashboard, Projects, ProjectDetail, Board, Resources
```

All state changes go through the reducer in `store/store.tsx`. To add a real backend later, replace that reducer with API calls; the pages don't need to change.
