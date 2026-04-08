import axios from 'axios'

const API = axios.create({ baseURL: 'http://localhost:8000' })

export const uploadTranscript = (formData, onProgress) =>
  API.post('/meetings/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress(Math.round((e.loaded * 100) / e.total)),
  })

export const getMeetings = () => API.get('/meetings')
export const extractFromMeeting = (id) => API.post(`/extract/${id}`)
export const getExtractions = (id) => API.get(`/extract/${id}`)
export const askQuestion = (question, meetingId = null) =>
  API.post('/chat/', { question, meeting_id: meetingId })
export const analyseSentiment = (id) => API.post(`/sentiment/${id}`)
export const getSummary = (id) => API.post(`/extract/summary/${id}`)
export const exportCSV = (id) => window.open(`http://localhost:8000/extract/export/${id}/csv`)
export const exportPDF = (id) => window.open(`http://localhost:8000/extract/export/${id}/pdf`)
export const searchMeetings = (q) => API.get(`/meetings/search?q=${q}`)