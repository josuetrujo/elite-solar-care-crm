import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import PendingApproval from './pages/PendingApproval'
import Dashboard from './pages/Dashboard'
import CallMode from './pages/CallMode'
import Callbacks from './pages/Callbacks'
import Contacts from './pages/Contacts'
import CustomerDetail from './pages/CustomerDetail'
import Schedule from './pages/Schedule'
import Invoices from './pages/Invoices'
import Reports from './pages/Reports'
import Cleanup from './pages/Cleanup'
import Settings from './pages/Settings'

export default function App() {
  const { user, loading, recovering, approved, isDemo } = useAuth()

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>
  }

  // Coming back from a password-reset email beats every other screen.
  if (recovering) return <ResetPassword />

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  // Signed in, but an admin hasn't let them in yet.
  if (!isDemo && !approved) return <PendingApproval />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/call" element={<CallMode />} />
        <Route path="/callbacks" element={<Callbacks />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        {/* The old separate lists are now filters on the one contact list. */}
        <Route path="/leads" element={<Navigate to="/contacts?class=lead" replace />} />
        <Route path="/customers" element={<Navigate to="/contacts?class=customer" replace />} />
        <Route path="/lists" element={<Navigate to="/contacts?class=dnc" replace />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/cleanup" element={<Cleanup />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
