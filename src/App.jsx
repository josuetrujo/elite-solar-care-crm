import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CallMode from './pages/CallMode'
import Leads from './pages/Leads'
import Callbacks from './pages/Callbacks'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import OtherLists from './pages/OtherLists'
import Schedule from './pages/Schedule'
import Invoices from './pages/Invoices'
import Settings from './pages/Settings'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/call" element={<CallMode />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/callbacks" element={<Callbacks />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/lists" element={<OtherLists />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
