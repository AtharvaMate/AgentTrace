import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import AgentDetail from './pages/AgentDetail'
import RegisterAgent from './pages/RegisterAgent'
import SimulateActivity from './pages/SimulateActivity'

function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agents/:agentId" element={<AgentDetail />} />
          <Route path="/register" element={<RegisterAgent />} />
          <Route path="/simulate" element={<SimulateActivity />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
