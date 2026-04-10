import { useEffect, useState } from 'react'
import { getIndexStatus, indexMeeting, ragQuery } from '../api/meetings'

function ChatPanel({ meetingId }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: meetingId
        ? 'Ask me anything about this meeting - decisions, action items, or what anyone said.'
        : 'Ask me anything across all your meetings.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [indexStatus, setIndexStatus] = useState({ indexed: false, chunk_count: 0, loading: true, embedding_pending: false, embedding_enabled: false })

  const loadStatus = async () => {
    if (!meetingId) {
      setIndexStatus({ indexed: true, chunk_count: 0, loading: false, embedding_pending: false, embedding_enabled: false })
      return
    }

    try {
      const res = await getIndexStatus(meetingId)
      setIndexStatus({ ...res.data, loading: false })
    } catch {
      setIndexStatus({ indexed: false, chunk_count: 0, loading: false, embedding_pending: false, embedding_enabled: false })
    }
  }

  useEffect(() => {
    loadStatus()
  }, [meetingId])

  useEffect(() => {
    if (!meetingId || !indexStatus.embedding_pending) return

    const timer = window.setInterval(() => {
      loadStatus()
    }, 2500)

    return () => window.clearInterval(timer)
  }, [meetingId, indexStatus.embedding_pending])

  const handleIndex = async () => {
    if (!meetingId || indexing) return
    setIndexing(true)
    try {
      const res = await indexMeeting(meetingId)
      setIndexStatus({
        indexed: true,
        chunk_count: res.data.chunks_created,
        loading: false,
        timestamped_chunk_count: res.data.timestamps_detected ? res.data.chunks_created : 0,
        embedding_pending: true,
        embedding_enabled: false,
      })
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `This meeting is now indexed for retrieval. I can cite ${res.data.chunks_created} transcript chunks in my answers.`,
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: 'Indexing failed. Please check that the transcript file still exists and try again.' },
      ])
    } finally {
      setIndexing(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    if (meetingId && !indexStatus.indexed) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: 'Index this meeting first so I can search the transcript and cite the right passages.' },
      ])
      return
    }

    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setLoading(true)

    try {
      const res = await ragQuery(question, meetingId, 5)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: res.data.answer,
          sources: res.data.sources,
          chunks_used: res.data.chunks_used,
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: 'I could not find a grounded answer in the indexed transcript chunks. Try rephrasing or re-indexing the meeting.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" style={{ height: '520px' }}>
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
        <h3 className="font-medium text-gray-900">Ask AI</h3>
      </div>

      {meetingId && (
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50">
          <div>
            <p className="text-sm text-gray-700">
              {indexStatus.loading
                ? 'Checking transcript index status...'
                : indexStatus.indexed
                  ? indexStatus.embedding_pending
                    ? `Indexed ${indexStatus.chunk_count} chunks. Embeddings are still processing in the background.`
                    : indexStatus.embedding_enabled
                      ? `Indexed and ready with ${indexStatus.chunk_count} chunks and semantic search enabled`
                      : `Indexed and ready with ${indexStatus.chunk_count} chunks`
                  : 'This meeting is not indexed yet'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Indexing enables chunk retrieval immediately; embeddings improve match quality once ready.</p>
          </div>
          <button
            type="button"
            onClick={handleIndex}
            disabled={indexing}
            className="shrink-0 text-xs border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition disabled:opacity-50"
          >
            {indexing ? 'Indexing...' : indexStatus.indexed ? 'Re-index Transcript' : 'Index Transcript'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
            >
              {msg.text}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                  <p className="text-xs text-gray-400">Sources: {msg.chunks_used} chunks used</p>
                  {msg.sources.map((s, j) => (
                    <div key={j} className="text-xs">
                      <p className="text-indigo-500">{s.citation || `${s.meeting_title} - lines ${s.line_start}-${s.line_end}`}</p>
                      {s.speaker_name && (
                        <p className="text-gray-400">Speaker: {s.speaker_name}</p>
                      )}
                      {!s.speaker_name && s.speaker_hint && (
                        <p className="text-gray-400">Speakers: {s.speaker_hint}</p>
                      )}
                      {s.timestamp_start && s.timestamp_end && (
                        <p className="text-gray-400">{s.timestamp_start} - {s.timestamp_end}</p>
                      )}
                      <p className="text-gray-400">{s.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question about this meeting..."
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-indigo-400 transition"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}

export default ChatPanel
