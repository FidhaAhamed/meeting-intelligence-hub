import { useNavigate } from 'react-router-dom'

function MeetingCard({ meeting }) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/meeting/${meeting.id}`)}
      className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-indigo-200 transition"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-gray-900 truncate">{meeting.title}</h3>
        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full ml-2 shrink-0">
          {meeting.file_name.split('.').pop().toUpperCase()}
        </span>
      </div>
      <div className="flex gap-4 text-xs text-gray-400">
        <span>{meeting.word_count.toLocaleString()} words</span>
        <span>{meeting.speaker_count} speakers</span>
        <span>{new Date(meeting.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

export default MeetingCard