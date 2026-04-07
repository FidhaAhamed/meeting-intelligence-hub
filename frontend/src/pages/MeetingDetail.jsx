import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getMeetings } from '../api/meetings'
import ExtractionPanel from '../components/ExtractionPanel'
import ChatPanel from '../components/ChatPanel'
import SentimentDashboard from '../components/SentimentDashboard'

function MeetingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState(null)
  const [tab, setTab] = useState('extract')

  useEffect(() => {
    getMeetings().then(res => {
      const found = res.data.find(m => m.id === parseInt(id))
      if (!found) navigate('/')
      setMeeting(found)
    })
  }, [id])

  if (!meeting) return <p className="text-gray-400">Loading...</p>

  return (
    <div>
      <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1">
        ← Back to dashboard
      </button>

      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">{meeting.title}</h2>
        <div className="flex gap-4 mt-2 text-sm text-gray-400">
          <span>{meeting.word_count.toLocaleString()} words</span>
          <span>{meeting.speaker_count} speakers</span>
          <span>{new Date(meeting.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('extract')}
          className={`px-4 py-2 rounded-md text-sm transition ${tab === 'extract' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Decisions & Actions
        </button>
        <button
          onClick={() => setTab('chat')}
          className={`px-4 py-2 rounded-md text-sm transition ${tab === 'chat' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Ask AI
        </button>
        <button
          onClick={() => setTab('sentiment')}
          className={`px-4 py-2 rounded-md text-sm transition ${tab === 'sentiment' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Sentiment
        </button>
      </div>

      {tab === 'extract' && <ExtractionPanel meetingId={parseInt(id)} />}
      {tab === 'chat' && <ChatPanel meetingId={parseInt(id)} />}
      {tab === 'sentiment' && <SentimentDashboard meetingId={parseInt(id)} />}
    </div>
  )
}

export default MeetingDetail