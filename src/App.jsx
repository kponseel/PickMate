import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CreateDecisionPage from './pages/CreateDecisionPage'
import DecisionDetailPage from './pages/DecisionDetailPage'
import VotingPage from './pages/VotingPage'
import VoteDonePage from './pages/VoteDonePage'
import ProfilePage from './pages/ProfilePage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-rose-50">
        <div className="w-16 h-16 bg-rose-600 rounded-2xl flex items-center justify-center mb-4 animate-bounce-in">
          <span className="text-white text-xl font-bold">PM</span>
        </div>
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />

            {/* Voting routes - public, no auth required */}
            <Route path="/vote/:id" element={<VotingPage />} />
            <Route path="/vote/:id/done" element={<VoteDonePage />} />

            {/* Protected owner routes */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="decision/:id" element={<DecisionDetailPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Protected but outside Layout (no bottom nav) */}
            <Route
              path="decision/new"
              element={
                <ProtectedRoute>
                  <CreateDecisionPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
