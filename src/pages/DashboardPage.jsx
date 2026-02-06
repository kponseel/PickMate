import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function DashboardPage() {
  const { user } = useAuth()
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const q = query(
      collection(db, 'decisions'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setDecisions(items)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const categoryIcons = {
    food: '🍕',
    movie: '🎬',
    activity: '🎯',
    travel: '✈️',
    shopping: '🛍️',
    other: '💡',
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Decisions</h1>
          <p className="text-sm text-gray-500 mt-1">Create and share polls</p>
        </div>
      </div>

      {decisions.length === 0 ? (
        <div className="empty-state py-16">
          <div className="empty-state-icon">🗳️</div>
          <h3 className="empty-state-title">No decisions yet</h3>
          <p className="empty-state-text">Create your first decision and share it with others</p>
          <Link to="/decision/new" className="btn-primary mt-6 inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Decision
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {decisions.map((decision, index) => (
            <Link
              key={decision.id}
              to={`/decision/${decision.id}`}
              className={`card-modern p-4 block animate-slide-up stagger-${Math.min(index + 1, 5)}`}
              style={{ opacity: 0 }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center text-2xl">
                  {categoryIcons[decision.category] || '💡'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{decision.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      decision.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {decision.status === 'active' ? 'Active' : 'Completed'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {decision.createdAt?.toDate?.()?.toLocaleDateString() || 'Just now'}
                    </span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* FAB */}
      <Link
        to="/decision/new"
        className="fab"
        style={{ position: 'fixed', bottom: '5rem', right: '1.5rem' }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </Link>
    </div>
  )
}
