import { useState } from 'react'
import { useCouple } from '../contexts/CoupleContext'
import { useAuth } from '../contexts/AuthContext'

export default function CouplePage() {
  const { user } = useAuth()
  const { couple, partner, loading, createCouple, joinCouple, leaveCouple } = useCouple()
  const [inviteCode, setInviteCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-pulse text-gray-400">Loading...</div></div>
  }

  // Already in a couple
  if (couple) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
          <div className="text-4xl mb-3">💑</div>
          <h2 className="text-lg font-bold text-gray-900">Your Couple</h2>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl">
              <div className="w-10 h-10 bg-rose-200 rounded-full flex items-center justify-center text-rose-700 font-bold">
                {(user.displayName || user.email)?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">{user.displayName || 'You'}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>

            {partner ? (
              <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl">
                <div className="w-10 h-10 bg-rose-200 rounded-full flex items-center justify-center text-rose-700 font-bold">
                  {(partner.displayName || partner.email)?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{partner.displayName || 'Partner'}</p>
                  <p className="text-xs text-gray-500">{partner.email}</p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-xl text-gray-500 text-sm">
                Waiting for your partner to join...
              </div>
            )}
          </div>

          {couple.members.length < 2 && (
            <div className="mt-4 p-4 bg-rose-50 rounded-xl">
              <p className="text-sm text-gray-600 mb-2">Share this invite code:</p>
              <p className="text-2xl font-bold tracking-widest text-rose-600">{couple.inviteCode}</p>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(couple.inviteCode)
                }}
                className="mt-2 text-sm text-rose-600 underline"
              >
                Copy code
              </button>
            </div>
          )}
        </div>

        <button
          onClick={async () => {
            if (window.confirm('Are you sure you want to leave this couple?')) {
              await leaveCouple()
            }
          }}
          className="w-full py-3 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium"
        >
          Leave couple
        </button>
      </div>
    )
  }

  // No couple yet — create or join
  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="text-4xl mb-3">💕</div>
        <h2 className="text-xl font-bold text-gray-900">Connect with your partner</h2>
        <p className="text-gray-500 mt-1 text-sm">Create a couple or join with an invite code</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>
      )}

      {/* Create couple */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-3">Create a couple</h3>
        <p className="text-sm text-gray-500 mb-4">Start a new couple and invite your partner.</p>

        {generatedCode ? (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Share this code with your partner:</p>
            <p className="text-3xl font-bold tracking-widest text-rose-600">{generatedCode}</p>
            <button
              onClick={() => navigator.clipboard?.writeText(generatedCode)}
              className="mt-2 text-sm text-rose-600 underline"
            >
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
              } catch (err) {
                setError(err.message)
              } finally {
                setBusy(false)
              }
            }}
            className="w-full py-3 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 active:bg-rose-800 transition-colors disabled:opacity-50"
          >
            {busy ? '...' : 'Create couple'}
          </button>
        )}
      </div>

      {/* Join couple */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-3">Join a couple</h3>
        <p className="text-sm text-gray-500 mb-4">Enter the invite code from your partner.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            try {
              await joinCouple(inviteCode)
            } catch (err) {
              setError(err.message)
            } finally {
              setBusy(false)
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-center tracking-widest font-bold text-lg uppercase"
          />
          <button
            type="submit"
            disabled={busy || inviteCode.length < 4}
            className="px-6 py-3 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 active:bg-rose-800 transition-colors disabled:opacity-50"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  )
}
