import { db } from '../data'
import { useAuth } from '../context/AuthContext'
import { USE_SUPABASE, FEATURES } from '../lib/config'
import { CheckCircle2, XCircle, Database, CreditCard, MessageSquare, Mail } from 'lucide-react'

export default function Settings() {
  const { user, isAdmin, isDemo } = useAuth()

  const Row = ({ icon, label, on, note }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="flex items-center gap-2 text-sm">{icon}{label}</span>
      <span className={`flex items-center gap-1 text-sm font-medium ${on ? 'text-emerald-600' : 'text-slate-400'}`}>
        {on ? <CheckCircle2 size={16} /> : <XCircle size={16} />}{on ? 'On' : (note || 'Off')}
      </span>
    </div>
  )

  async function resetDemo() {
    if (!confirm('Reset demo data back to the samples?')) return
    await db.resetDemo()
    location.reload()
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-bold">Settings</h1>

      <div className="card p-5">
        <h2 className="font-semibold mb-2">Connections</h2>
        <Row icon={<Database size={16} />} label="Cloud database & logins (Supabase)" on={USE_SUPABASE} note="Demo mode" />
        <Row icon={<CreditCard size={16} />} label="Card payments (Square)" on={FEATURES.payments} />
        <Row icon={<MessageSquare size={16} />} label="SMS reminders (Twilio)" on={FEATURES.sms} />
        <Row icon={<Mail size={16} />} label="Email reminders (Resend)" on={FEATURES.email} />
        <p className="text-xs text-slate-500 mt-3">
          Each feature turns on automatically when you add its keys to <code className="px-1 bg-slate-100 rounded">.env</code>.
          See the vault guide: CRM-Integrations-Setup-Guide.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-2">Your account</h2>
        <p className="text-sm text-slate-600">Signed in as <b>{user?.name}</b> ({user?.email}) — role <b className="capitalize">{user?.role}</b>.</p>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-2">Team & permissions</h2>
        {isDemo ? (
          <p className="text-sm text-slate-500">
            User management turns on with Supabase. Roles: <b>admin</b> (full access + manage users),
            <b> member</b> (edit customers/jobs/invoices), <b>viewer</b> (read-only). The admin can change
            anyone's role from Supabase → Table editor → profiles, or this screen once connected.
          </p>
        ) : isAdmin ? (
          <p className="text-sm text-slate-500">
            You're an admin. To add a user: have them sign up, then set their role in Supabase → Table editor → profiles
            (admin / member / viewer). A built-in user manager can be added here next.
          </p>
        ) : (
          <p className="text-sm text-slate-500">Only admins can manage the team.</p>
        )}
      </div>

      {isDemo && (
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Demo</h2>
          <p className="text-sm text-slate-500 mb-3">You're in local demo mode. Changes are saved in this browser only.</p>
          <button className="btn-ghost" onClick={resetDemo}>Reset demo data</button>
        </div>
      )}
    </div>
  )
}
