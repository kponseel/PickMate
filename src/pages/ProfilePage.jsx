import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
        <div className="w-20 h-20 bg-rose-200 rounded-full flex items-center justify-center text-rose-700 text-2xl font-bold mx-auto mb-4">
          {(user.displayName || user.email)?.[0]?.toUpperCase() || '?'}
        </div>
        <h2 className="text-lg font-bold text-gray-900">{user.displayName || 'User'}</h2>
        <p className="text-gray-500 text-sm">{user.email}</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
        <h3 className="font-semibold text-gray-900">Account</h3>
        <div className="text-sm text-gray-600">
          <p>Provider: {user.providerData?.[0]?.providerId || 'email'}</p>
          <p>Member since: {new Date(user.metadata?.creationTime).toLocaleDateString()}</p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full py-3 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium"
      >
        Sign out
      </button>

      <p className="text-center text-xs text-gray-400">
        PickMate v1.0 — Made with care for couples
      </p>
    </div>
  )
}
