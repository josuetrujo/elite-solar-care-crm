import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Table2, TrendingUp } from 'lucide-react'
import { db } from '../data'
import { fmtMoney } from '../lib/dates'
import { dispositionLabel } from '../lib/config'

// Charts here are deliberately single-series: one blue hue for magnitude, grey
// for context. Nothing is encoded by colour alone — every bar is labelled and
// there's a table view underneath.
const ACCENT = '#004AAD'   // brand-600
const MUTED = '#64748B'    // slate-500 — passes 3:1 on white

const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export default function Reports() {
  const [r, setR] = useState(null)
  const [error, setError] = useState(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    db.report().then(setR).catch((e) => setError(e.message || 'Could not build the report'))
  }, [])

  if (error) return <p className="text-rose-600">⚠️ {error}</p>
  if (!r) return <p className="text-slate-400">Crunching the numbers…</p>

  const months = (r.revenue_by_month || []).map((m) => ({ ...m, total: Number(m.total) }))
  const maxMonth = Math.max(1, ...months.map((m) => m.total))
  // Past ~8 columns a value on every cap turns to mush; then only the peak is
  // labelled and the rest live in the tooltip and the "Show numbers" table.
  const denseLabels = months.length > 8

  const outcomes = Object.entries(r.calls_by_outcome || {})
    .map(([key, n]) => ({ key, label: dispositionLabel(key), n }))
    .sort((a, b) => b.n - a.n)
  const maxOutcome = Math.max(1, ...outcomes.map((o) => o.n))

  const sales = r.calls_by_outcome?.sale || 0
  const conversion = r.calls_total > 0 ? (sales / r.calls_total) * 100 : 0
  const callsPerSale = sales > 0 ? r.calls_total / sales : null
  const reachable = r.contacts_total - r.unreachable

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 size={20} /> Reports</h1>
        <p className="text-sm text-slate-500">Everything below comes from your real calls, jobs and invoices.</p>
      </div>

      {/* Hero: the one number the page leads with */}
      <div className="card p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Collected to date</div>
        <div className="text-5xl font-bold text-brand-700 leading-none mt-1">{fmtMoney(r.collected)}</div>
        <div className="text-sm text-slate-500 mt-2">
          Across {r.jobs_completed} completed {r.jobs_completed === 1 ? 'job' : 'jobs'}
          {Number(r.outstanding) > 0 && <> · <span className="text-amber-600 font-medium">{fmtMoney(r.outstanding)} still outstanding</span></>}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Average job" value={fmtMoney(r.avg_ticket)} hint="Per paid invoice" />
        <Stat label="Customers won" value={r.customers_total.toLocaleString()} hint={`of ${r.contacts_total.toLocaleString()} contacts`} />
        <Stat
          label="Calls logged"
          value={r.calls_total.toLocaleString()}
          hint={callsPerSale ? `${callsPerSale.toFixed(1)} calls per sale` : 'No sales logged yet'}
        />
        <Stat
          label="Booked ahead"
          value={r.jobs_scheduled.toLocaleString()}
          hint={r.jobs_scheduled === 1 ? 'cleaning on the calendar' : 'cleanings on the calendar'}
        />
      </div>

      {/* Revenue by month — single series, so no legend: the heading says what it is */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">Money collected each month</h2>
          {months.length > 1 && (
            <button className="btn-ghost !h-8 !px-3" onClick={() => setShowTable((v) => !v)}>
              <Table2 size={14} /> {showTable ? 'Show chart' : 'Show numbers'}
            </button>
          )}
        </div>

        {months.length === 0 ? (
          <EmptyState
            title="No paid invoices yet"
            body="Once you mark an invoice paid, the month-by-month picture builds itself here."
            to="/invoices" cta="Go to Invoices"
          />
        ) : months.length === 1 ? (
          // One month isn't a chart — it's a number.
          <div className="mt-3">
            <div className="text-3xl font-bold text-brand-700">{fmtMoney(months[0].total)}</div>
            <div className="text-sm text-slate-500 mt-1">
              in {monthLabel(months[0].month)} · {months[0].jobs} {months[0].jobs === 1 ? 'job' : 'jobs'}
            </div>
            <p className="text-xs text-slate-400 mt-2">A month-by-month chart appears once there's a second month to compare against.</p>
          </div>
        ) : showTable ? (
          <table className="w-full text-sm mt-3">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="text-left py-2">Month</th><th className="text-right py-2">Jobs</th><th className="text-right py-2">Collected</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {months.map((m) => (
                <tr key={m.month}>
                  <td className="py-2">{monthLabel(m.month)}</td>
                  <td className="py-2 text-right text-slate-600">{m.jobs}</td>
                  <td className="py-2 text-right font-medium">{fmtMoney(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="mt-4">
            <div className="flex items-end gap-2 h-52" role="img"
              aria-label={`Money collected by month: ${months.map((m) => `${monthLabel(m.month)} ${fmtMoney(m.total)}`).join(', ')}`}>
              {months.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full group"
                  title={`${monthLabel(m.month)} · ${fmtMoney(m.total)} from ${m.jobs} ${m.jobs === 1 ? 'job' : 'jobs'}`}>
                  {/* Labelled on the cap, not on hover — there is no hover on a phone. */}
                  <span className={`text-[11px] font-semibold text-slate-600 mb-1 ${
                    denseLabels && m.total !== maxMonth ? 'opacity-0 group-hover:opacity-100 transition' : ''
                  }`}>
                    {fmtMoney(m.total)}
                  </span>
                  <div
                    className="w-full max-w-[24px] rounded-t transition-opacity group-hover:opacity-80"
                    style={{
                      height: `${Math.max(2, (m.total / maxMonth) * 100)}%`,
                      background: ACCENT,
                      borderTopLeftRadius: 4, borderTopRightRadius: 4,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-slate-200 pt-1.5 mt-0">
              {months.map((m) => (
                <div key={m.month} className="flex-1 text-center text-[11px] text-slate-500 truncate">
                  {monthLabel(m.month)}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {denseLabels
                ? 'The best month is labelled; press "Show numbers" for the full list.'
                : 'Press "Show numbers" to see this as a table.'}
            </p>
          </div>
        )}
      </div>

      {/* Call outcomes — emphasis form: sales in brand blue, everything else grey */}
      <div className="card p-5">
        <h2 className="font-semibold mb-1">How your calls land</h2>
        <p className="text-xs text-slate-500 mb-3">Sales are highlighted; every other outcome is context.</p>
        {outcomes.length === 0 ? (
          <EmptyState
            title="No calls logged yet"
            body="Call Mode logs an outcome every time you press one of the big buttons. This fills in from there."
            to="/call" cta="Open Call Mode"
          />
        ) : (
          <ul className="space-y-2">
            {outcomes.map((o) => (
              <li key={o.key} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-slate-600 truncate">{o.label}</span>
                <span className="flex-1 bg-slate-100 rounded h-5 overflow-hidden">
                  <span className="block h-full rounded"
                    style={{ width: `${(o.n / maxOutcome) * 100}%`, background: o.key === 'sale' ? ACCENT : MUTED }} />
                </span>
                <span className="w-12 text-right font-semibold tabular-nums text-slate-700">{o.n}</span>
              </li>
            ))}
          </ul>
        )}
        {r.calls_total > 0 && (
          <p className="text-sm text-slate-600 mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
            <TrendingUp size={16} className="text-brand-600" />
            <span>
              <b>{conversion.toFixed(1)}%</b> of logged calls ended in a sale
              {callsPerSale && <> — about <b>{Math.round(callsPerSale)}</b> {Math.round(callsPerSale) === 1 ? 'call' : 'calls'} per customer won.</>}
            </span>
          </p>
        )}
      </div>

      {/* Where the list stands */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3">Where your list stands</h2>
        <ul className="space-y-2 text-sm">
          <Funnel label="Contacts in the CRM" n={r.contacts_total} of={r.contacts_total} />
          <Funnel label="With a number you can dial" n={reachable} of={r.contacts_total} />
          <Funnel label="Still to call (leads)" n={r.leads_total} of={r.contacts_total} />
          <Funnel label="Customers won" n={r.customers_total} of={r.contacts_total} />
        </ul>
        {r.unreachable > 0 && (
          <p className="text-xs text-slate-500 mt-3">
            {r.unreachable.toLocaleString()} contacts have no usable phone number.{' '}
            <Link to="/cleanup" className="text-brand-600 hover:underline">Clean those up</Link>.
          </p>
        )}
      </div>
    </div>
  )
}

const Stat = ({ label, value, hint }) => (
  <div className="card p-4">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-2xl font-bold leading-none mt-1 text-slate-800">{value}</div>
    {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
  </div>
)

const Funnel = ({ label, n, of }) => (
  <li className="flex items-center gap-3">
    <span className="w-48 shrink-0 text-slate-600">{label}</span>
    <span className="flex-1 bg-slate-100 rounded h-5 overflow-hidden">
      <span className="block h-full rounded" style={{ width: `${of ? (n / of) * 100 : 0}%`, background: ACCENT }} />
    </span>
    <span className="w-16 text-right font-semibold tabular-nums text-slate-700">{n.toLocaleString()}</span>
  </li>
)

const EmptyState = ({ title, body, to, cta }) => (
  <div className="text-center py-6">
    <p className="font-medium text-slate-700">{title}</p>
    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{body}</p>
    <Link to={to} className="btn-ghost !h-9 inline-flex mt-3">{cta}</Link>
  </div>
)
