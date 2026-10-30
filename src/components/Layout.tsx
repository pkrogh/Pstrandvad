import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AlertTriangle, Cloud, FolderKanban, LayoutDashboard, Loader2, Menu, RefreshCw, RotateCcw, SquareKanban, Users, X } from 'lucide-react'
import { useStore } from '../store/store'
import { timeAgo } from '../lib/dates'
import { Avatar, cx } from './ui'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/board', label: 'Task board', icon: SquareKanban },
  { to: '/resources', label: 'Resources', icon: Users },
]

export function Layout() {
  const { state, dispatch, sync, refresh } = useStore()
  const [open, setOpen] = useState(false)
  const me = state.members.find((m) => m.id === state.currentUserId)
  const adoConfigured = __ADO_CONFIG__.enabled
  const activeProjects = state.projects.filter((p) => p.status === 'active')

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        <span className="text-base font-semibold tracking-tight text-slate-900">Strandvad PM</span>
      </div>
      <nav className="space-y-0.5 px-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-8 px-6 text-xs font-semibold tracking-wide text-slate-400 uppercase">Active projects</div>
      <div className="mt-2 space-y-0.5 px-3">
        {activeProjects.map((p) => (
          <NavLink
            key={p.id}
            to={`/projects/${p.id}`}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cx('flex items-center gap-3 truncate rounded-lg px-3 py-1.5 text-sm', isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50')
            }
          >
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="truncate">{p.name}</span>
          </NavLink>
        ))}
      </div>
      <div className="mt-auto border-t border-slate-200 p-4">
        {adoConfigured && (
          <div className="mb-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Cloud size={13} /> Azure DevOps · {__ADO_CONFIG__.project}
            </div>
            <div className="mt-0.5 text-slate-500">
              {sync.status === 'loading' ? 'Syncing…' : sync.source === 'ado' ? `Synced ${sync.lastSync ? timeAgo(sync.lastSync.toISOString()) : ''}` : 'Sync failed — showing demo data'}
            </div>
            <button
              onClick={refresh}
              disabled={sync.status === 'loading'}
              className="mt-1.5 flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              <RefreshCw size={12} className={sync.status === 'loading' ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        )}
        {sync.source === 'mock' && (
          <button
            onClick={() => confirm('Reset all data back to the original mock data?') && dispatch({ type: 'reset' })}
            className="mb-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <RotateCcw size={14} /> Reset demo data
          </button>
        )}
        {me && (
          <div className="flex items-center gap-3 px-2">
            <Avatar member={me} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{me.name}</div>
              <div className="truncate text-xs text-slate-500">{me.role}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button className="absolute top-4 right-3 rounded p-1 text-slate-400 hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded p-1 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <span className="font-semibold">Strandvad PM</span>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {sync.status === 'error' && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Couldn’t load data from Azure DevOps — showing demo data instead.</p>
                <p className="mt-0.5 text-red-700">{sync.error}</p>
              </div>
              <button onClick={refresh} className="shrink-0 font-medium underline">
                Retry
              </button>
            </div>
          )}
          {sync.source === 'ado' && sync.status !== 'error' && (
            <p className="mb-4 text-xs text-slate-400">Read-only sync: edits you make here are kept in this browser tab only and are not written back to Azure DevOps.</p>
          )}
          {sync.status === 'loading' && state.projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-500">
              <Loader2 size={28} className="animate-spin text-indigo-500" />
              <p className="mt-3 text-sm">Loading epics and work items from Azure DevOps…</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
