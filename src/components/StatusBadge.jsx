import { PIPELINE } from '../lib/config'

export default function StatusBadge({ status }) {
  const s = PIPELINE.find((p) => p.key === status) || PIPELINE[0]
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>
      {s.label}
    </span>
  )
}
