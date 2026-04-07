import { useDropzone } from 'react-dropzone'
import { useState } from 'react'
import { uploadTranscript } from '../api/meetings'

function UploadZone({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const onDrop = async (acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setError('Only .txt and .vtt files are supported.')
      return
    }
    setError(null)
    setUploading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      acceptedFiles.forEach((file) => formData.append('files', file))
      await uploadTranscript(formData, setProgress)
      onUploadSuccess()
    } catch (err) {
      setError('Upload failed. Make sure the backend is running.')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'], 'text/vtt': ['.vtt'] },
    multiple: true,
  })

  return (
    <div className="mb-8">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition
          ${isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-4">🎙️</div>
        {isDragActive ? (
          <p className="text-indigo-600 font-medium">Drop your transcripts here...</p>
        ) : (
          <>
            <p className="text-gray-600 font-medium mb-1">Drag and drop transcript files here</p>
            <p className="text-gray-400 text-sm">Supports .txt and .vtt — multiple files at once</p>
            <button className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition">
              Browse Files
            </button>
          </>
        )}
      </div>

      {uploading && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}
    </div>
  )
}

export default UploadZone