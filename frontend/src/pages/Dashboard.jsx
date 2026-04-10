import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadZone from '../components/UploadZone'
import { deleteMeeting, getDashboardStats, getMeetings, searchMeetings } from '../api/meetings'

const DEFAULT_DASHBOARD_STATS = {
  totalMeetings: 0,
  totalProjects: 0,
  totalActions: 0,
  totalDecisions: 0,
  averageSentiment: null,
  sentimentLabel: 'Unscored',
}

function StatCard({ label, value, sub, loading }) {
  if (loading) return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-24 mb-3"></div>
      <div className="h-7 bg-gray-200 rounded w-16 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-20"></div>
    </div>
  )
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function MeetingCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
        <div className="h-4 bg-gray-200 rounded w-10"></div>
      </div>
      <div className="flex gap-3">
        <div className="h-3 bg-gray-200 rounded w-16"></div>
        <div className="h-3 bg-gray-200 rounded w-16"></div>
        <div className="h-3 bg-gray-200 rounded w-20"></div>
      </div>
    </div>
  )
}

function MeetingCard({ meeting, deletingId, onDelete }) {
  const navigate = useNavigate()
  const isDeleting = deletingId === meeting.id

  const handleDelete = async (event) => {
    event.stopPropagation()
    const confirmed = window.confirm(`Remove "${meeting.title}" from the dashboard? This also deletes the uploaded transcript file.`)
    if (!confirmed) return
    await onDelete(meeting)
  }

  return (
    <div
      onClick={() => navigate(`/meeting/${meeting.id}`)}
      className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-indigo-300 transition group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 group-hover:text-indigo-600 transition truncate">
            {meeting.title}
          </h3>
          {meeting.project_name && (
            <p className="text-xs text-gray-400 mt-1 truncate">{meeting.project_name}</p>
          )}
        </div>
        <div className="ml-2 flex items-center gap-2 shrink-0">
          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
            {meeting.file_name.split('.').pop().toUpperCase()}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label={`Delete ${meeting.title}`}
          >
            {isDeleting ? 'Removing...' : 'x'}
          </button>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-gray-400">
        <span>{meeting.word_count.toLocaleString()} words</span>
        <span>{meeting.speaker_count} speakers</span>
        <span>{new Date(meeting.meeting_date || meeting.created_at).toLocaleDateString()}</span>
      </div>
      <div className="mt-2 flex gap-2 flex-wrap">
        {meeting.meeting_type && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full capitalize">
            {meeting.meeting_type}
          </span>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">Click to analyse</span>
        <span className="text-xs text-indigo-400 group-hover:translate-x-1 transition-transform">-&gt;</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [filtered, setFiltered] = useState([])
  const [dashboardStats, setDashboardStats] = useState(DEFAULT_DASHBOARD_STATS)

  const loadDashboardStats = async () => {
    try {
      const res = await getDashboardStats()
      setDashboardStats({
        totalMeetings: res.data.total_meetings,
        totalProjects: res.data.total_projects,
        totalActions: res.data.total_actions,
        totalDecisions: res.data.total_decisions,
        averageSentiment: res.data.average_sentiment,
        sentimentLabel: res.data.sentiment_label,
      })
    } catch (error) {
      console.error(error)
      setDashboardStats(DEFAULT_DASHBOARD_STATS)
    }
  }

  const fetchMeetings = async () => {
    setLoading(true)
    try {
      const [meetingsRes] = await Promise.all([
        getMeetings(),
        loadDashboardStats(),
      ])
      setMeetings(meetingsRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMeetings() }, [])
  useEffect(() => { setFiltered(meetings) }, [meetings])

  const handleSearch = async (value) => {
    setSearch(value)
    if (value.trim() === '') {
      setFiltered(meetings)
      return
    }

    try {
      const res = await searchMeetings(value)
      setFiltered(res.data)
    } catch {
      setFiltered(
        meetings.filter(meeting =>
          `${meeting.title} ${meeting.project_name || ''} ${meeting.meeting_type || ''}`
            .toLowerCase()
            .includes(value.toLowerCase())
        )
      )
    }
  }

  const handleDeleteMeeting = async (meeting) => {
    setDeletingId(meeting.id)
    try {
      await deleteMeeting(meeting.id)
      setMeetings(current => current.filter(item => item.id !== meeting.id))
      setFiltered(current => current.filter(item => item.id !== meeting.id))
      await loadDashboardStats()
    } catch (err) {
      console.error(err)
      window.alert('Could not delete this meeting. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-400 mt-0.5">All your meeting transcripts in one place</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition"
        >
          {showUpload ? 'Cancel' : '+ Upload Transcript'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total meetings" value={dashboardStats.totalMeetings} sub="transcripts uploaded" loading={loading} />
        <StatCard label="Projects" value={dashboardStats.totalProjects} sub="active workstreams" loading={loading} />
        <StatCard label="Action items" value={dashboardStats.totalActions} sub="extracted tasks" loading={loading} />
        <StatCard label="Decisions" value={dashboardStats.totalDecisions} sub="captured agreements" loading={loading} />
        <StatCard
          label="Avg sentiment"
          value={dashboardStats.averageSentiment !== null ? dashboardStats.averageSentiment.toFixed(2) : '-'}
          sub={dashboardStats.sentimentLabel}
          loading={loading}
        />
      </div>

      {showUpload && (
        <div className="mb-6">
          <UploadZone onUploadSuccess={() => { setShowUpload(false); fetchMeetings() }} />
        </div>
      )}

      {meetings.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search meetings, projects, or meeting types..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full max-w-sm border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-400 transition"
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <MeetingCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 && search ? (
        <p className="text-gray-400 text-sm">No meetings match "{search}"</p>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-4xl mb-4">Records</div>
          <h3 className="text-gray-600 font-medium mb-2">No meetings yet</h3>
          <p className="text-gray-400 text-sm">Click "Upload Transcript" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(meeting => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              deletingId={deletingId}
              onDelete={handleDeleteMeeting}
            />
          ))}
        </div>
      )}
    </div>
  )
}
