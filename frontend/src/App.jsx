import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import MeetingDetail from './pages/MeetingDetail'
import AskAI from './pages/AskAI'
import Analytics from './pages/Analytics'

const navItems = [
  {
    label: 'Dashboard',
    path: '/',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    )
  },
  {
    label: 'Meetings',
    path: '/meetings',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
      </svg>
    )
  },
  {
    label: 'Ask AI',
    path: '/ask',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    )
  },
]

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col px-3 py-6 shrink-0">

      <div className="px-3 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">Meeting Hub</span>
        </div>
        <p className="text-xs text-gray-500 pl-9">AI-powered insights</p>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider px-3 mb-2">Navigation</p>
        {navItems.map(item => {
          const active = location.pathname === item.path ||
            (item.path === '/meetings' && location.pathname === '/meetings')
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm transition w-full
                ${active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              <span className={active ? 'text-white' : 'text-gray-500'}>{item.icon}</span>
              {item.label}
              {item.badge && (
                <span className="ml-auto text-xs bg-indigo-900 text-indigo-300 px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      
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
          <Route path="/meetings" element={<Dashboard />} />
          <Route path="/meeting/:id" element={<MeetingDetail />} />
          <Route path="/ask" element={<AskAI />} />
          <Route path="/analytics" element={<Analytics />} />
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