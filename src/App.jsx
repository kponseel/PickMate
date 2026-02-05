import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CoupleProvider } from './contexts/CoupleContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DecisionsPage from './pages/DecisionsPage'
import DecisionDetailPage from './pages/DecisionDetailPage'
import CouplePage from './pages/CouplePage'
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
        <CoupleProvider>
          <ToastProvider>
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DecisionsPage />} />
                <Route path="decision/:id" element={<DecisionDetailPage />} />
                <Route path="couple" element={<CouplePage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </CoupleProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
