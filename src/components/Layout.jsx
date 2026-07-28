import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, PhoneCall, Phone, Users, CalendarClock, CalendarDays, Receipt, Settings as Cog, ListFilter, LogOut, Menu, BarChart3, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { APP_NAME } from '../lib/config'
import logo from '../assets/logo.png'
import OfflineBar from './OfflineBar'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/call', label: 'Call Mode', icon: Phone },
  { to: '/leads', label: 'Leads', icon: PhoneCall },
  { to: '/callbacks', label: 'Callbacks', icon: CalendarClock },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/invoices', label: 'Invoices', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/lists', label: 'Other lists', icon: ListFilter },
  { to: '/cleanup', label: 'Clean up list', icon: Sparkles, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Cog },
]

export default function Layout({ children }) {
  const { user, signOut, isDemo, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const SidebarInner = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-200">
        <img src={logo} alt="Elite Solar Care" className="w-8 h-8 rounded-full shrink-0" />
        <span className="font-display font-extrabold text-[15px] text-slate-800 leading-tight">Elite Solar Care</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.filter((n) => !n.adminOnly || isAdmin).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
              }`
            }>
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className="px-2 pb-2 text-xs text-slate-500">
          <div className="font-semibold text-slate-700">{user?.name}</div>
          <div className="capitalize">{user?.role}{isDemo ? ' · demo' : ''}</div>
        </div>
        <button className="btn-ghost w-full justify-center" onClick={async () => { await signOut(); navigate('/') }}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-60 shrink-0 bg-white border-r border-slate-200">
        <SidebarInner />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl"><SidebarInner /></aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-3 bg-white border-b border-slate-200 px-4 py-3">
          <button onClick={() => setOpen(true)} className="text-slate-600"><Menu /></button>
          <img src={logo} alt="" className="w-6 h-6 rounded-full" />
          <span className="font-display font-bold text-slate-800">{APP_NAME}</span>
        </header>
        <OfflineBar />
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
