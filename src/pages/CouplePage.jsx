import { useState } from 'react'
import { useCouple } from '../contexts/CoupleContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { SkeletonCard } from '../components/Skeleton'

export default function CouplePage() {
  const { user } = useAuth()
  const { couple, partner, loading, createCouple, joinCouple, leaveCouple } = useCouple()
  const toast = useToast()
  const [inviteCode, setInviteCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  async function handleCopyCode(code) {
    try {
      await navigator.clipboard?.writeText(code)
      toast.success('Code copied!')
    } catch {
      toast.error('Could not copy')
    }
  }

  // Already in a couple
  if (couple) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Couple Status Card */}
        <div className="card-elevated p-6 text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-in">
            <span className="text-3xl">{partner ? '💑' : '💕'}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {partner ? 'Your Couple' : 'Almost there!'}
          </h2>
          <p className="text-sm text-gray-500">
            {partner ? 'Connected and ready to decide together' : 'Waiting for your partner to join'}
          </p>
        </div>

        {/* Members */}
        <div className="space-y-3">
          {/* Current user */}
          <div className="card-modern p-4 animate-slide-up stagger-1" style={{ opacity: 0 }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-rose-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-rose-200">
                {(user.displayName || user.email)?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{user.displayName || 'You'}</p>
                <p className="text-sm text-gray-500 truncate">{user.email}</p>
              </div>
              <span className="badge badge-rose">You</span>
            </div>
          </div>

          {/* Partner */}
          {partner ? (
            <div className="card-modern p-4 animate-slide-up stagger-2" style={{ opacity: 0 }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-200">
                  {(partner.displayName || partner.email)?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{partner.displayName || 'Partner'}</p>
                  <p className="text-sm text-gray-500 truncate">{partner.email}</p>
                </div>
                <span className="badge badge-default">Partner</span>
              </div>
            </div>
          ) : (
            <div className="card-modern p-6 text-center border-dashed border-2 animate-slide-up stagger-2" style={{ opacity: 0 }}>
              <div className="text-4xl mb-3 animate-float">⏳</div>
              <p className="text-gray-500 text-sm mb-4">Share your invite code</p>
              <div className="bg-rose-50 rounded-xl p-4">
                <p className="text-3xl font-bold tracking-[0.3em] text-rose-600 font-mono">
                  {couple.inviteCode}
                </p>
              </div>
              <button
                onClick={() => handleCopyCode(couple.inviteCode)}
                className="mt-4 btn-primary"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Code
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Leave couple */}
        <button
          onClick={async () => {
            if (window.confirm('Are you sure you want to leave this couple?')) {
              await leaveCouple()
              toast.info('Left couple')
            }
          }}
          className="w-full py-3 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium"
        >
          Leave couple
        </button>
      </div>
    )
  }

  // No couple yet — create or join
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center py-6">
        <div className="text-5xl mb-4 animate-float">💕</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect with your partner</h2>
        <p className="text-gray-500">Create a couple or join with an invite code</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl animate-shake">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Create couple */}
      <div className="card-elevated p-6 animate-slide-up stagger-1" style={{ opacity: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
            <span className="text-xl">✨</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Create a couple</h3>
            <p className="text-sm text-gray-500">Start new and invite your partner</p>
          </div>
        </div>

        {generatedCode ? (
          <div className="text-center p-4 bg-green-50 rounded-xl animate-scale-in">
            <p className="text-sm text-gray-600 mb-3">Share this code:</p>
            <p className="text-3xl font-bold tracking-[0.3em] text-rose-600 font-mono">{generatedCode}</p>
            <button
              onClick={() => handleCopyCode(generatedCode)}
              className="mt-4 text-rose-600 font-medium text-sm flex items-center gap-1 mx-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy code
            </button>
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError('')
              try {
                const code = await createCouple()
                setGeneratedCode(code)
                toast.success('Couple created!')
              } catch (err) {
                setError(err.message)
              } finally {
                setBusy(false)
              }
            }}
            className="btn-primary w-full"
          >
            {busy ? 'Creating...' : 'Create couple'}
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 uppercase font-medium">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Join couple */}
      <div className="card-elevated p-6 animate-slide-up stagger-2" style={{ opacity: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <span className="text-xl">🔗</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Join a couple</h3>
            <p className="text-sm text-gray-500">Enter your partner's invite code</p>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            try {
              await joinCouple(inviteCode)
              toast.success('Joined couple!')
            } catch (err) {
              setError(err.message)
            } finally {
              setBusy(false)
            }
          }}
          className="space-y-3"
        >
          <input
            type="text"
            placeholder="ABCDEF"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="input-modern text-center tracking-[0.3em] font-bold text-xl uppercase font-mono"
          />
          <button
            type="submit"
            disabled={busy || inviteCode.length < 4}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Joining...' : 'Join couple'}
          </button>
        </form>
      </div>
    </div>
  )
}
