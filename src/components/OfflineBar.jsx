import { useEffect, useState } from 'react'
import { CloudOff, UploadCloud, CheckCircle2, WifiOff } from 'lucide-react'
import { onPendingChange, syncOutbox } from '../lib/calls'

// A thin status strip that appears only when something needs saying: you're
// offline, or call outcomes are waiting to upload. Silent the rest of the time.
export default function OfflineBar() {
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [syncing, setSyncing] = useState(false)
  const [justSent, setJustSent] = useState(0)

  useEffect(() => onPendingChange(setPending), [])

  useEffect(() => {
    async function sync() {
      if (!navigator.onLine) return
      setSyncing(true)
      try {
        const res = await syncOutbox()
        if (res.sent > 0) {
          setJustSent(res.sent)
          setTimeout(() => setJustSent(0), 6000)
        }
      } finally { setSyncing(false) }
    }
    function goOnline() { setOnline(true); sync() }
    function goOffline() { setOnline(false) }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    sync() // catch anything left over from a previous session

    // Belt and braces: retry every 30s while anything is still waiting.
    const t = setInterval(() => { if (navigator.onLine) sync() }, 30_000)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      clearInterval(t)
    }
  }, [])

  if (justSent > 0) {
    return (
      <Bar tone="bg-emerald-600">
        <CheckCircle2 size={15} />
        {justSent} call {justSent === 1 ? 'outcome' : 'outcomes'} uploaded.
      </Bar>
    )
  }

  if (pending > 0) {
    return (
      <Bar tone={online ? 'bg-brand-600' : 'bg-amber-500 text-amber-950'}>
        {online ? <UploadCloud size={15} /> : <CloudOff size={15} />}
        {pending} call {pending === 1 ? 'outcome' : 'outcomes'} saved on this device
        {online ? (syncing ? ' — uploading…' : ' — uploading shortly') : ' — will upload when you have signal'}
      </Bar>
    )
  }

  if (!online) {
    return (
      <Bar tone="bg-slate-700">
        <WifiOff size={15} />
        No connection. You can still log calls — they'll upload when signal comes back.
      </Bar>
    )
  }

  return null
}

const Bar = ({ tone, children }) => (
  <div className={`${tone} text-white text-sm font-medium px-4 py-2 flex items-center justify-center gap-2`}>
    {children}
  </div>
)
