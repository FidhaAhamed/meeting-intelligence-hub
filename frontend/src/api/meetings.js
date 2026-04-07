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
