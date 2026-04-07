import { useState, useEffect } from 'react'
import { analyseSentiment } from '../api/meetings'

const scoreToColor = (score) => {
  if (score >= 0.3) return { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' }
  if (score <= -0.3) return { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' }
  return { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500' }
}

const labelIcon = (label) => {
  if (label === 'Positive') return '🟢'
  if (label === 'Negative') return '🔴'
  return '🟡'
}

function ScoreBar({ score }) {
  const pct = Math.round(((score + 1) / 2) * 100)
  const color = scoreToColor(score)
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${color.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{score.toFixed(2)}</span>
    </div>
  )
}

function SentimentDashboard({ meetingId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedSegment, setSelectedSegment] = useState(null)

  const handleAnalyse = async () => {
    setLoading(true)
    try {
      const res = await analyseSentiment(meetingId)
      setData(res.data)
    } catch {
      alert('Sentiment analysis failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!data) {
    return (
      <div className="text-center py-10 bg-white border border-gray-200 rounded-xl">
        <div className="text-3xl mb-3">📊</div>
        <p className="text-gray-600 mb-4">Analyse the emotional tone and sentiment of this meeting</p>
        <button
          onClick={handleAnalyse}
          disabled={loading}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? 'Analysing tone...' : 'Run Sentiment Analysis'}
        </button>
      </div>
    )
  }

  const overallColor = scoreToColor(data.overall_score)

  return (
    <div className="space-y-6">

      {/* Re-run button */}
      <div className="flex justify-end">
        <button onClick={handleAnalyse} disabled={loading} className="text-sm text-indigo-600 hover:underline disabled:opacity-50">
          {loading ? 'Re-analysing...' : 'Re-analyse'}
        </button>
      </div>

      {/* Overall score card */}
      <div className={`rounded-xl p-6 ${overallColor.bg} border border-opacity-20`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-semibold text-lg ${overallColor.text}`}>
            {labelIcon(data.overall_label)} Overall meeting tone — {data.overall_label}
          </h3>
          <span className={`text-2xl font-bold ${overallColor.text}`}>
            {data.overall_score.toFixed(2)}
          </span>
        </div>
        <ScoreBar score={data.overall_score} />
        <p className="mt-3 text-sm text-gray-600">{data.summary}</p>
      </div>

      {/* Speaker breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-900">Speaker sentiment breakdown</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {data.speakers.map((speaker, i) => {
            const color = scoreToColor(speaker.sentiment_score)
            return (
              <div key={i} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{speaker.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                      {speaker.sentiment_label}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {speaker.tone_tags.map((tag, j) => (
                      <span key={j} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <ScoreBar score={speaker.sentiment_score} />
                {speaker.key_quote && (
                  <p className="mt-2 text-xs text-gray-400 italic">"{speaker.key_quote}"</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Segment timeline */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-900">Conversation timeline</h3>
          <p className="text-xs text-gray-400 mt-1">Click a segment to view the text</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex gap-1 flex-wrap mb-4">
            {data.segments.map((seg, i) => {
              const color = scoreToColor(seg.score)
              return (
                <button
                  key={i}
                  onClick={() => setSelectedSegment(selectedSegment === i ? null : i)}
                  className={`h-8 w-8 rounded-md transition hover:opacity-80 ${color.bar} ${selectedSegment === i ? 'ring-2 ring-indigo-400' : ''}`}
                  title={seg.sentiment}
                />
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-400 mb-4">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block"></span>Positive</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500 inline-block"></span>Neutral</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block"></span>Negative</span>
          </div>

          {/* Selected segment text */}
          {selectedSegment !== null && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 border border-gray-200">
              <p className="text-xs text-gray-400 mb-1">Segment {selectedSegment + 1} — {data.segments[selectedSegment].sentiment}</p>
              <p>{data.segments[selectedSegment].text}</p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

export default SentimentDashboard