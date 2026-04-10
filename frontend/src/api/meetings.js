import axios from 'axios'

const API = axios.create({ baseURL: 'http://localhost:8000' })

export const uploadTranscript = (formData, onProgress) =>
  API.post('/meetings/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress(Math.round((e.loaded * 100) / e.total)),
  })

export const getMeetings = () => API.get('/meetings')
export const getDashboardStats = () => API.get('/meetings/stats')
export const deleteMeeting = (id) => API.delete(`/meetings/${id}`)
export const extractFromMeeting = (id) => API.post(`/extract/${id}`)
export const getExtractions = (id) => API.get(`/extract/${id}`)
export const analyseSentiment = (id) => API.post(`/sentiment/${id}`)
export const getSummary = (id) => API.post(`/extract/summary/${id}`)
export const exportCSV = (id) => window.open(`http://localhost:8000/extract/export/${id}/csv`)
export const exportPDF = (id) => window.open(`http://localhost:8000/extract/export/${id}/pdf`)
export const searchMeetings = (q) => API.get(`/meetings/search?q=${q}`)
export const indexMeeting = (id) => API.post(`/rag/index/${id}`)
export const ragQuery = (question, meetingId = null, topK = 3) =>
  API.post('/rag/query', { question, meeting_id: meetingId, top_k: topK })
export const getIndexStatus = (id) => API.get(`/rag/status/${id}`)
