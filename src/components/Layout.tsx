import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { FolderKanban, LayoutDashboard, Menu, RotateCcw, SquareKanban, Users, X } from 'lucide-react'
import { CURRENT_USER_ID, useStore } from '../store/store'
import { Avatar, cx } from './ui'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/board', label: 'Task board', icon: SquareKanban },
  { to: '/resources', label: 'Resources', icon: Users },
]

export function Layout() {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const me = state.members.find((m) => m.id === CURRENT_USER_ID)
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
        <button
          onClick={() => confirm('Reset all data back to the original mock data?') && dispatch({ type: 'reset' })}
          className="mb-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <RotateCcw size={14} /> Reset demo data
        </button>
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
          <Outlet />
        </main>
      </div>
    </div>
  )
}
