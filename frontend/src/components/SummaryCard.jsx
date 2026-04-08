import { useEffect, useState } from 'react'
import { getSummary } from '../api/meetings'

function SummaryCard({ meetingId }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await getSummary(meetingId)
      setSummary(res.data)
    } catch {} finally { setLoading(false) }
  }

  if (!summary) return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 flex items-center justify-between">
      <p className="text-sm text-indigo-600">Generate a TL;DR summary of this meeting</p>
      <button onClick={fetch} disabled={loading}
        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
        {loading ? 'Generating...' : 'Summarise'}
      </button>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{summary.meeting_type}</span>
        <span className="text-xs text-gray-400">{summary.estimated_duration}</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-400">{summary.participants?.join(', ')}</span>
      </div>
      <p className="text-sm text-gray-700 mb-3">{summary.tldr}</p>
      <div className="flex gap-2 flex-wrap">
        {summary.key_topics?.map((t, i) => (
          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{t}</span>
        ))}
      </div>
    </div>
  )
}

export default SummaryCard