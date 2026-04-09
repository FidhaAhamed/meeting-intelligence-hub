import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadZone from '../components/UploadZone'
import { deleteMeeting, getMeetings, searchMeetings } from '../api/meetings'

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
        <h3 className="font-medium text-gray-900 group-hover:text-indigo-600 transition truncate">
          {meeting.title}
        </h3>
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
            {isDeleting ? 'Removing...' : '✕'}
          </button>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-gray-400">
        <span>{meeting.word_count.toLocaleString()} words</span>
        <span>{meeting.speaker_count} speakers</span>
        <span>{new Date(meeting.created_at).toLocaleDateString()}</span>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">Click to analyse</span>
        <span className="text-xs text-indigo-400 group-hover:translate-x-1 transition-transform">→</span>
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

  const fetchMeetings = async () => {
    setLoading(true)
    try {
      const res = await getMeetings()
      setMeetings(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMeetings() }, [])

  const totalWords = meetings.reduce((sum, m) => sum + m.word_count, 0)
  const [filtered, setFiltered] = useState([])

  useEffect(() => { setFiltered(meetings) }, [meetings])

  const handleSearch = async (val) => {
    setSearch(val)
    if (val.trim() === '') {
      setFiltered(meetings)
      return
    }
    try {
      const res = await searchMeetings(val)
      setFiltered(res.data)
    } catch {
      setFiltered(meetings.filter(m => m.title.toLowerCase().includes(val.toLowerCase())))
    }
  }

  const handleDeleteMeeting = async (meeting) => {
    setDeletingId(meeting.id)
    try {
      await deleteMeeting(meeting.id)
      setMeetings(current => current.filter(item => item.id !== meeting.id))
      setFiltered(current => current.filter(item => item.id !== meeting.id))
    } catch (err) {
      console.error(err)
      window.alert('Could not delete this meeting. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      {/* Page header */}
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

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total meetings" value={meetings.length} sub="transcripts uploaded" loading={loading} />
        <StatCard label="Total words" value={totalWords.toLocaleString()} sub="across all meetings" loading={loading} />
        <StatCard label="Avg words" value={meetings.length ? Math.round(totalWords / meetings.length).toLocaleString() : 0} sub="per meeting" loading={loading} />
        <StatCard label="Speakers detected" value={meetings.reduce((s, m) => s + m.speaker_count, 0)} sub="across all meetings" loading={loading} />
      </div>

      {/* Upload zone */}
      {showUpload && (
        <div className="mb-6">
          <UploadZone onUploadSuccess={() => { setShowUpload(false); fetchMeetings() }} />
        </div>
      )}

      {/* Search */}
      {meetings.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search meetings..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full max-w-sm border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-400 transition"
          />
        </div>
      )}

      {/* Meetings grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <MeetingCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 && search ? (
        <p className="text-gray-400 text-sm">No meetings match "{search}"</p>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-4xl mb-4">🎙️</div>
          <h3 className="text-gray-600 font-medium mb-2">No meetings yet</h3>
          <p className="text-gray-400 text-sm">Click "Upload Transcript" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => (
            <MeetingCard
              key={m.id}
              meeting={m}
              deletingId={deletingId}
              onDelete={handleDeleteMeeting}
            />
          ))}
        </div>
      )}
    </div>
  )
}
