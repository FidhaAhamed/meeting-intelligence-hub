import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import MeetingDetail from './pages/MeetingDetail'

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col px-4 py-6 shrink-0">
      <div className="mb-8">
        <h1 className="text-base font-semibold text-white">Meeting Hub</h1>
        <p className="text-xs text-gray-400 mt-0.5">Powered by Groq AI</p>
      </div>
      <nav className="flex flex-col gap-1">
        <button
          onClick={() => navigate('/')}
          className={`text-left px-3 py-2 rounded-lg text-sm transition
            ${location.pathname === '/' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
        >
          Dashboard
        </button>
      </nav>
      <div className="mt-auto">
        <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded-full">API connected</span>
      </div>
    </aside>
  )
}

function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 px-8 py-8 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/meeting/:id" element={<MeetingDetail />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}

export default App