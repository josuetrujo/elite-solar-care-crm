import { useEffect, useState } from 'react'
import { db } from '../data'
import { useAuth } from '../context/AuthContext'
import { USE_SUPABASE, FEATURES } from '../lib/config'
import {
  CheckCircle2, XCircle, Database, CreditCard, MessageSquare, Mail,
  ShieldCheck, ShieldOff, UserPlus, X,
} from 'lucide-react'

const ROLES = [
  { key: 'admin', label: 'Admin', blurb: 'Everything, including approving people and deleting contacts' },
  { key: 'member', label: 'Member', blurb: 'Call, book jobs, edit customers and invoices' },
  { key: 'viewer', label: 'Viewer', blurb: 'Can look, cannot change anything' },
]

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
          Each feature turns on when you add its keys — step-by-step in <b>PAYMENTS-AND-REMINDERS.md</b>.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-2">Your account</h2>
        <p className="text-sm text-slate-600">
          Signed in as <b>{user?.name}</b> ({user?.email}) — role <b className="capitalize">{user?.role}</b>.
        </p>
      </div>

      <TeamPanel isAdmin={isAdmin} isDemo={isDemo} meId={user?.id} />

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

function TeamPanel({ isAdmin, isDemo, meId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)
  const [showInvite, setShowInvite] = useState(false)

  function load() {
    setLoading(true)
    db.listProfiles()
      .then((p) => { setRows(p); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { if (isAdmin) load(); else setLoading(false) }, [isAdmin])

  async function setApproved(p, approved) {
    if (!approved && !confirm(`Remove ${p.name || p.email}'s access? They'll be locked out immediately.`)) return
    setBusy(p.id)
    try {
      await db.updateProfile(p.id, {
        approved,
        approved_at: approved ? new Date().toISOString() : null,
      })
      load()
      setToast(approved
        ? `${p.name || p.email} can now use the CRM.`
        : `${p.name || p.email} has been locked out.`)
    } catch (e) { setToast(`Didn't work: ${e.message}`) } finally { setBusy(null) }
  }

  async function setRole(p, role) {
    setBusy(p.id)
    try {
      await db.updateProfile(p.id, { role })
      load()
      setToast(`${p.name || p.email} is now a ${role}.`)
    } catch (e) { setToast(`Didn't work: ${e.message}`) } finally { setBusy(null) }
  }

  if (!isAdmin) {
    return (
      <div className="card p-5">
        <h2 className="font-semibold mb-2">Team &amp; permissions</h2>
        <p className="text-sm text-slate-500">Only admins can manage the team.</p>
      </div>
    )
  }

  const waiting = rows.filter((p) => !p.approved)
  const active = rows.filter((p) => p.approved)

  const Person = ({ p }) => (
    <li className="py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium truncate">
          {p.name || p.email}
          {p.id === meId && <span className="text-xs text-slate-400 font-normal"> · you</span>}
        </div>
        <div className="text-xs text-slate-500 truncate">{p.email}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          className="input !w-auto !py-1.5 text-sm"
          value={p.role}
          disabled={busy === p.id || p.id === meId}
          title={p.id === meId ? "You can't change your own role" : ''}
          onChange={(e) => setRole(p, e.target.value)}
        >
          {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        {p.approved ? (
          p.id !== meId && (
            <button className="btn-ghost !h-8 !px-3 text-rose-600" disabled={busy === p.id}
              onClick={() => setApproved(p, false)}>
              <ShieldOff size={14} /> Remove
            </button>
          )
        ) : (
          <button className="btn-primary !h-8 !px-3" disabled={busy === p.id}
            onClick={() => setApproved(p, true)}>
            <ShieldCheck size={14} /> Approve
          </button>
        )}
      </div>
    </li>
  )

  return (
    <div className="card p-5">
      {toast && (
        <div className="mb-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 flex items-center justify-between gap-2">
          <span className="text-sm text-emerald-900">{toast}</span>
          <button className="text-emerald-700" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold">Team &amp; permissions</h2>
        <button className="btn-ghost !h-9" onClick={() => setShowInvite((v) => !v)}>
          <UserPlus size={16} /> Add someone
        </button>
      </div>

      {showInvite && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-4 my-3 text-sm text-slate-700 space-y-2">
          <p className="font-semibold text-slate-800">How to add a crew member</p>
          <ol className="list-decimal ml-5 space-y-1">
            <li>Send them the CRM's web address.</li>
            <li>They tap <b>Create an account</b> on the sign-in screen and pick their own password.</li>
            <li>Their name shows up here under <b>Waiting for approval</b>. Tap <b>Approve</b>.</li>
            <li>Set their role — <b>Member</b> is right for someone who calls leads and books jobs.</li>
          </ol>
          <p className="text-xs text-slate-500">
            Until you approve them they can sign in but see nothing at all — no customers, no phone numbers.
          </p>
        </div>
      )}

      {isDemo && (
        <p className="text-sm text-slate-500 mt-2">
          Team management works once the cloud database is connected. Roles:{' '}
          {ROLES.map((r) => <span key={r.key}><b>{r.label.toLowerCase()}</b> ({r.blurb}). </span>)}
        </p>
      )}

      {!isDemo && (
        loading ? <p className="text-sm text-slate-400 mt-3">Loading team…</p> : (
          <>
            {waiting.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                  Waiting for approval
                  <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px]">{waiting.length}</span>
                </h3>
                <ul className="divide-y divide-slate-100">
                  {waiting.map((p) => <Person key={p.id} p={p} />)}
                </ul>
              </div>
            )}

            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Has access <span className="text-slate-400 font-normal">({active.length})</span>
              </h3>
              <ul className="divide-y divide-slate-100">
                {active.map((p) => <Person key={p.id} p={p} />)}
              </ul>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-0.5">
              {ROLES.map((r) => <p key={r.key}><b className="text-slate-600">{r.label}</b> — {r.blurb}.</p>)}
            </div>
          </>
        )
      )}
    </div>
  )
}
