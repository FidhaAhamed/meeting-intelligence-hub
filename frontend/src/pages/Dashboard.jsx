import { useEffect, useState } from 'react'
import UploadZone from '../components/UploadZone'
import MeetingCard from '../components/MeetingCard'
import { getMeetings } from '../api/meetings'

function Dashboard() {
  const [meetings, setMeetings] = useState([])
  const [showUpload, setShowUpload] = useState(false)

  const fetchMeetings = async () => {
    try {
      const res = await getMeetings()
      setMeetings(res.data)
    } catch (err) {
      console.error('Could not fetch meetings', err)
    }
  }

  useEffect(() => { fetchMeetings() }, [])

  const handleUploadSuccess = () => {
    setShowUpload(false)
    fetchMeetings()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Your Meetings</h2>
          <p className="text-gray-500 text-sm mt-1">{meetings.length} transcript{meetings.length !== 1 ? 's' : ''} uploaded</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition"
        >
          {showUpload ? 'Cancel' : '+ Upload Transcript'}
        </button>
      </div>

      {showUpload && <UploadZone onUploadSuccess={handleUploadSuccess} />}

      {meetings.length === 0 && !showUpload ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-4xl mb-4">🎙️</div>
          <h3 className="text-gray-600 font-medium mb-2">No meetings yet</h3>
          <p className="text-gray-400 text-sm">Click "Upload Transcript" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {meetings.map((m) => <MeetingCard key={m.id} meeting={m} />)}
        </div>
      )}
    </div>
  )
}

export default Dashboard