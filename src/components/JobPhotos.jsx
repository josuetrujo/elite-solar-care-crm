import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, X, ImageOff } from 'lucide-react'
import { db } from '../data'
import { USE_SUPABASE } from '../lib/config'
import { downscaleImage } from '../lib/images'
import { fmtDate } from '../lib/dates'
import { useAuth } from '../context/AuthContext'

// Before/after photos of a cleaning. Worth having for three reasons: proof the
// work was done if a customer questions it, a reminder of what the array looks
// like before you next visit, and free marketing material.
export default function JobPhotos({ customerId, jobs = [] }) {
  const { canEdit, isAdmin } = useAuth()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [kind, setKind] = useState('after')
  const fileRef = useRef(null)

  function load() {
    setLoading(true)
    db.listJobPhotos(customerId)
      .then((p) => { setPhotos(p); setLoading(false) })
      .catch((e) => { setErr(e.message); setLoading(false) })
  }
  useEffect(() => { load() }, [customerId])

  async function onPick(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // let the same file be picked again later
    if (!files.length) return
    setBusy(true); setErr(null)
    try {
      // Attach to the most recent job so the photo has a date it belongs to.
      const jobId = jobs[0]?.id || null
      for (const file of files) {
        const { blob, dataUrl } = await downscaleImage(file)
        await db.addJobPhoto({ customerId, jobId, kind, blob, dataUrl })
      }
      load()
    } catch (e) {
      setErr(e.message || 'Upload failed')
    } finally { setBusy(false) }
  }

  async function remove(p) {
    if (!confirm('Delete this photo?')) return
    setBusy(true)
    try { await db.deleteJobPhoto(p); load() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const before = photos.filter((p) => p.kind === 'before')
  const after = photos.filter((p) => p.kind !== 'before')

  const Grid = ({ title, rows }) => (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500 mb-2">{title} ({rows.length})</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">None yet.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {rows.map((p) => (
            <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100">
              {p.url ? (
                <img src={p.url} alt={p.caption || `${p.kind} photo`} loading="lazy"
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightbox(p)} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageOff size={20} /></div>
              )}
              {canEdit && (
                <button
                  className="absolute top-1 right-1 rounded-md bg-black/55 text-white p-1 opacity-0 group-hover:opacity-100 transition"
                  title="Delete photo" onClick={() => remove(p)} disabled={busy}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2"><Camera size={16} /> Photos</h2>
        {canEdit && (
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
              {['before', 'after'].map((k) => (
                <button key={k} onClick={() => setKind(k)}
                  className={`px-2.5 py-1.5 capitalize ${kind === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'}`}>
                  {k}
                </button>
              ))}
            </div>
            <button className="btn-primary !h-9" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Camera size={16} /> {busy ? 'Uploading…' : 'Add photo'}
            </button>
            {/* capture="environment" makes phones open the rear camera directly */}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple
              className="hidden" onChange={onPick} />
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Pick <b>Before</b> or <b>After</b>, then take the photo. Pictures are shrunk on your phone before
        uploading, so it works on a weak signal.
        {!USE_SUPABASE && ' (Demo mode keeps them in this browser only.)'}
      </p>

      {err && <p className="text-sm text-rose-600 mb-3">⚠️ {err}</p>}
      {loading ? <p className="text-sm text-slate-400">Loading photos…</p> : (
        <div className="space-y-4">
          <Grid title="Before" rows={before} />
          <Grid title="After" rows={after} />
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <X size={24} />
          </button>
          <figure className="max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.caption || ''} className="max-h-[80vh] rounded-lg" />
            <figcaption className="text-center text-sm text-white/70 mt-2 capitalize">
              {lightbox.kind} · {fmtDate(lightbox.created_at)}
              {isAdmin && lightbox.caption ? ` · ${lightbox.caption}` : ''}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  )
}
