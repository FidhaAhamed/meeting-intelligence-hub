import { useState, useEffect } from 'react'
import { extractFromMeeting, getExtractions, exportCSV, exportPDF } from '../api/meetings'

function ExtractionPanel({ meetingId }) {
  const [data, setData] = useState({ decisions: [], action_items: [] })
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState(false)

  useEffect(() => {
    getExtractions(meetingId).then(res => {
      if (res.data.decisions.length > 0 || res.data.action_items.length > 0) {
        setData(res.data)
        setExtracted(true)
      }
    })
  }, [meetingId])

  const handleExtract = async () => {
    setLoading(true)
    try {
      const res = await extractFromMeeting(meetingId)
      setData(res.data)
      setExtracted(true)
    } catch (err) {
      alert('Extraction failed. Check your Groq API key.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Not yet extracted */}
      {!extracted && (
        <div className="text-center py-10 bg-white border border-gray-200 rounded-xl">
          <div className="text-3xl mb-3">🤖</div>
          <p className="text-gray-600 mb-4">Groq AI will analyze this transcript and extract key information</p>
          <button
            onClick={handleExtract}
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Extract Decisions & Action Items'}
          </button>
        </div>
      )}

      {/* Extracted results */}
      {extracted && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">AI extracted results</p>
            <div className="flex gap-2">
              <button
                onClick={() => exportCSV(meetingId)}
                className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
              >
                Export CSV
              </button>
              <button
                onClick={() => exportPDF(meetingId)}
                className="text-xs border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
              >
                Export PDF
              </button>
              <button
                onClick={handleExtract}
                disabled={loading}
                className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
              >
                {loading ? 'Re-analyzing...' : 'Re-analyze'}
              </button>
            </div>
          </div>

          {/* Decisions table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              <h3 className="font-medium text-gray-900">Decisions</h3>
              <span className="ml-auto text-xs text-gray-400">{data.decisions.length} found</span>
            </div>
            {data.decisions.length === 0 ? (
              <p className="text-gray-400 text-sm px-5 py-4">No decisions found</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-5 py-3">#</th>
                    <th className="text-left px-5 py-3">Decision</th>
                    <th className="text-left px-5 py-3">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.decisions.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-5 py-3 text-gray-700">
                        {d.description}
                        {d.evidence && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">"{d.evidence}"</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {d.confidence && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${d.confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                              d.confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'}`}>
                            {Math.round(d.confidence * 100)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Action items table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
              <h3 className="font-medium text-gray-900">Action Items</h3>
              <span className="ml-auto text-xs text-gray-400">{data.action_items.length} found</span>
            </div>
            {data.action_items.length === 0 ? (
              <p className="text-gray-400 text-sm px-5 py-4">No action items found</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-5 py-3">Owner</th>
                    <th className="text-left px-5 py-3">Task</th>
                    <th className="text-left px-5 py-3">Due</th>
                    <th className="text-left px-5 py-3">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.action_items.map((a, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full text-xs font-medium">
                          {a.owner}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        {a.task}
                        {a.evidence && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">"{a.evidence}"</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{a.due_date}</td>
                      <td className="px-5 py-3">
                        {a.confidence && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${a.confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                              a.confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'}`}>
                            {Math.round(a.confidence * 100)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ExtractionPanel