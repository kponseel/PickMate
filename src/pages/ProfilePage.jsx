import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const providerIcons = {
    'google.com': '🔵',
    'apple.com': '⚫',
    password: '📧',
  }

  const provider = user.providerData?.[0]?.providerId || 'password'
  const memberSince = new Date(user.metadata?.creationTime)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Card */}
      <div className="card-elevated p-8 text-center animate-scale-in">
        <div className="w-24 h-24 bg-gradient-to-br from-rose-400 to-rose-600 rounded-3xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-5 shadow-xl shadow-rose-200 animate-bounce-in">
          {(user.displayName || user.email)?.[0]?.toUpperCase() || '?'}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{user.displayName || 'User'}</h2>
        <p className="text-gray-500">{user.email}</p>
      </div>

      {/* Account Details */}
      <div className="card-elevated overflow-hidden animate-slide-up stagger-1" style={{ opacity: 0 }}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Account Details</h3>
        </div>

        <div className="divide-y divide-gray-100">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg">
                {providerIcons[provider] || '📧'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Sign-in method</p>
                <p className="text-xs text-gray-500 capitalize">{provider.replace('.com', '')}</p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg">
                📅
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Member since</p>
                <p className="text-xs text-gray-500">
                  {memberSince.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg">
                🔐
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Account ID</p>
                <p className="text-xs text-gray-500 font-mono">{user.uid.slice(0, 12)}...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 animate-slide-up stagger-2" style={{ opacity: 0 }}>
        <button
          onClick={handleLogout}
          className="w-full py-4 flex items-center justify-center gap-2 text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>

      {/* Footer */}
      <div className="text-center py-6 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">PM</span>
          </div>
          <span className="font-semibold text-gray-900">PickMate</span>
        </div>
        <p className="text-xs text-gray-400">
          Version 2.0.0 • Create decisions, share links, collect votes
        </p>
      </div>
    </div>
  )
}
