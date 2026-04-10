import { useState } from 'react'
import { ragQuery } from '../api/meetings'

function AskAI() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ask me anything across all your meetings. I will search through every transcript to find the answer.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setLoading(true)

    try {
      const res = await ragQuery(question, null, 5)
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: res.data.answer,
        sources: res.data.sources,
        chunks_used: res.data.chunks_used
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Could not find an answer. Make sure your meetings are indexed first — go to a meeting, open the Ask AI tab, and click Index Transcript.'
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Ask AI</h2>
        <p className="text-sm text-gray-400 mt-1">Search across all indexed meeting transcripts</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" style={{ height: '70vh' }}>

        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
            <span className="text-sm font-medium text-gray-900">Global search</span>
          </div>
        </div>

        {/* Suggested questions */}
        <div className="px-5 py-3 border-b border-gray-100 flex gap-2 flex-wrap">
          {[
            'What decisions were made across all meetings?',
            'Who has the most action items?',
            'What topics come up most often?'
          ].map((q, i) => (
            <button
              key={i}
              onClick={() => setInput(q)}
              className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                {msg.text}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                    <p className="text-xs text-gray-400">{msg.chunks_used} chunks searched</p>
                    {msg.sources.map((s, j) => (
                      <div key={j} className="text-xs">
                        <div className="flex justify-between items-center gap-3">
                          <span className="text-indigo-500">{s.citation || `${s.meeting_title} · lines ${s.line_start}-${s.line_end}`}</span>
                          <span className="text-gray-400">{(s.similarity_score * 100).toFixed(0)}% match</span>
                        </div>
                        {s.timestamp_start && s.timestamp_end && (
                          <p className="text-gray-400 mt-0.5">{s.timestamp_start} - {s.timestamp_end}</p>
                        )}
                        {s.speaker_name && (
                          <p className="text-gray-400 mt-0.5">Speaker: {s.speaker_name}</p>
                        )}
                        {!s.speaker_name && s.speaker_hint && (
                          <p className="text-gray-400 mt-0.5">Speakers: {s.speaker_hint}</p>
                        )}
                        <p className="text-gray-400 mt-0.5">{s.snippet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything across all meetings..."
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
    </div>
  )
}

export default AskAI
