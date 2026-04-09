import { useEffect, useState } from 'react'
import { getMeetings, getExtractions } from '../api/meetings'
import { useNavigate } from 'react-router-dom'

function StatCard({ label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit mb-3 ${colors[color]}`}>{label}</div>
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-32 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-gray-500 w-6 text-right shrink-0">{value}</span>
    </div>
  )
}

export default function Analytics() {
  const [meetings, setMeetings] = useState([])
  const [allExtractions, setAllExtractions] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await getMeetings()
        setMeetings(res.data)
        const extractions = await Promise.all(
          res.data.map(m => getExtractions(m.id).catch(() => ({ data: { decisions: [], action_items: [] } })))
        )
        setAllExtractions(extractions.map((e, i) => ({
          meeting: res.data[i],
          ...e.data
        })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalWords = meetings.reduce((s, m) => s + m.word_count, 0)
  const totalDecisions = allExtractions.reduce((s, e) => s + (e.decisions?.length || 0), 0)
  const totalActions = allExtractions.reduce((s, e) => s + (e.action_items?.length || 0), 0)

  // Owner frequency map
  const ownerMap = {}
  allExtractions.forEach(e => {
    e.action_items?.forEach(a => {
      ownerMap[a.owner] = (ownerMap[a.owner] || 0) + 1
    })
  })
  const topOwners = Object.entries(ownerMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxOwner = topOwners[0]?.[1] || 1

  // Words per meeting bar
  const maxWords = Math.max(...meetings.map(m => m.word_count), 1)

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-40 mb-6"></div>
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>)}
      </div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
        <p className="text-sm text-gray-400 mt-1">Insights across all your meetings</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Meetings" value={meetings.length} sub="total uploaded" color="indigo" />
        <StatCard label="Total words" value={totalWords.toLocaleString()} sub="across all transcripts" color="purple" />
        <StatCard label="Decisions" value={totalDecisions} sub="AI-extracted" color="green" />
        <StatCard label="Action items" value={totalActions} sub="assigned tasks" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Action items by person */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-4">Action items by person</h3>
          {topOwners.length === 0 ? (
            <p className="text-sm text-gray-400">No action items extracted yet. Open a meeting and run extraction first.</p>
          ) : (
            <div className="space-y-3">
              {topOwners.map(([owner, count]) => (
                <BarRow key={owner} label={owner} value={count} max={maxOwner} color="bg-indigo-500" />
              ))}
            </div>
          )}
        </div>

        {/* Words per meeting */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-4">Transcript length by meeting</h3>
          {meetings.length === 0 ? (
            <p className="text-sm text-gray-400">No meetings uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {meetings.slice(0, 6).map(m => (
                <BarRow key={m.id} label={m.title} value={m.word_count} max={maxWords} color="bg-purple-500" />
              ))}
            </div>
          )}
        </div>

        {/* Decisions per meeting */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-4">Decisions per meeting</h3>
          {allExtractions.every(e => !e.decisions?.length) ? (
            <p className="text-sm text-gray-400">No decisions extracted yet.</p>
          ) : (
            <div className="space-y-3">
              {allExtractions.map(e => (
                <BarRow
                  key={e.meeting.id}
                  label={e.meeting.title}
                  value={e.decisions?.length || 0}
                  max={Math.max(...allExtractions.map(x => x.decisions?.length || 0), 1)}
                  color="bg-green-500"
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent meetings table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-900">All meetings</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-5 py-3">Meeting</th>
                <th className="text-left px-5 py-3">Words</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allExtractions.map(e => (
                <tr
                  key={e.meeting.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/meeting/${e.meeting.id}`)}
                >
                  <td className="px-5 py-3 text-gray-700 font-medium">{e.meeting.title}</td>
                  <td className="px-5 py-3 text-gray-400">{e.meeting.word_count.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full">
                      {e.action_items?.length || 0} tasks
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}