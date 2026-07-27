import { useState } from 'react'
import ContactList from '../components/ContactList'

const TABS = [
  { key: 'dnc', label: 'Do Not Call' },
  { key: 'lost', label: 'Lost (Not Interested)' },
  { key: 'bad_number', label: 'Bad Numbers' },
]

export default function OtherLists() {
  const [tab, setTab] = useState('dnc')
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <ContactList key={tab} segment={tab} title={TABS.find((t) => t.key === tab).label} />
    </div>
  )
}
