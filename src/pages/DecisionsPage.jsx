import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCouple } from '../contexts/CoupleContext'
import { useDecisions } from '../hooks/useDecisions'
import BottomSheet from '../components/BottomSheet'
import { SkeletonList } from '../components/Skeleton'

const categories = [
  { value: 'food', label: 'Food', icon: '🍽️', color: 'bg-orange-50' },
  { value: 'travel', label: 'Travel', icon: '✈️', color: 'bg-blue-50' },
  { value: 'movie', label: 'Movie', icon: '🎬', color: 'bg-purple-50' },
  { value: 'activity', label: 'Activity', icon: '🎯', color: 'bg-green-50' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️', color: 'bg-pink-50' },
  { value: 'other', label: 'Other', icon: '💡', color: 'bg-gray-50' },
]

const quickTemplates = [
  { title: 'Where to eat?', category: 'food', icon: '🍕' },
  { title: 'What to watch?', category: 'movie', icon: '🍿' },
  { title: 'Weekend plans?', category: 'activity', icon: '🎉' },
]

const statusConfig = {
  open: { label: 'Voting', class: 'badge-success', dot: 'bg-green-500' },
  closed: { label: 'Closed', class: 'badge-default', dot: 'bg-gray-400' },
  archived: { label: 'Done', class: 'badge-warning', dot: 'bg-amber-500' },
}

export default function DecisionsPage() {
  const { couple } = useCouple()
  const { decisions, loading, createDecision } = useDecisions()
  const navigate = useNavigate()
  const [showSheet, setShowSheet] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')

  // No couple state
  if (!couple) {
    return (
      <div className="empty-state min-h-[60vh]">
        <div className="empty-state-icon">💕</div>
        <h2 className="empty-state-title">Connect with your partner</h2>
        <p className="empty-state-text">
          Create a couple or join your partner to start making decisions together
        </p>
        <button onClick={() => navigate('/couple')} className="btn-primary">
          Get Started
        </button>
      </div>
    )
  }

  // Loading state with skeletons
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="skeleton h-7 w-28 rounded-lg" />
        </div>
        <SkeletonList count={4} />
      </div>
    )
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!title.trim()) return
    await createDecision(title.trim(), category)
    setTitle('')
    setCategory('other')
    setShowSheet(false)
  }

  async function handleQuickCreate(template) {
    await createDecision(template.title, template.category)
    setShowSheet(false)
  }

  const activeDecisions = decisions.filter(d => d.status === 'open')
  const closedDecisions = decisions.filter(d => d.status !== 'open')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Decisions</h2>
          <p className="text-sm text-gray-500">{decisions.length} total</p>
        </div>
      </div>

      {/* Empty state */}
      {decisions.length === 0 ? (
        <div className="empty-state py-16">
          <div className="empty-state-icon">🤔</div>
          <h3 className="empty-state-title">No decisions yet</h3>
          <p className="empty-state-text">
            Tap the + button to create your first decision together
          </p>
        </div>
      ) : (
        <>
          {/* Active decisions */}
          {activeDecisions.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Active ({activeDecisions.length})
              </h3>
              <div className="space-y-3">
                {activeDecisions.map((d, i) => (
                  <DecisionCard key={d.id} decision={d} index={i} navigate={navigate} />
                ))}
              </div>
            </section>
          )}

          {/* Completed decisions */}
          {closedDecisions.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Completed ({closedDecisions.length})
              </h3>
              <div className="space-y-3">
                {closedDecisions.map((d, i) => (
                  <DecisionCard key={d.id} decision={d} index={i} navigate={navigate} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Floating Action Button */}
      <button onClick={() => setShowSheet(true)} className="fab" aria-label="New decision">
        <span>+</span>
      </button>

      {/* Bottom Sheet for creating decision */}
      <BottomSheet
        isOpen={showSheet}
        onClose={() => setShowSheet(false)}
        title="New Decision"
      >
        {/* Quick Templates */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-500 mb-3">Quick start</p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
            {quickTemplates.map((t, i) => (
              <button
                key={i}
                onClick={() => handleQuickCreate(t)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <span className="text-xl">{t.icon}</span>
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{t.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex items-center mb-6">
          <div className="flex-grow border-t border-gray-200" />
          <span className="flex-shrink mx-4 text-gray-400 text-sm">or create custom</span>
          <div className="flex-grow border-t border-gray-200" />
        </div>

        {/* Custom form */}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="What are you deciding?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
              className="input-modern text-lg"
              autoFocus
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-3">Category</p>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                    category === c.value
                      ? 'bg-rose-600 text-white shadow-md scale-105'
                      : `${c.color} text-gray-700 hover:scale-102`
                  }`}
                >
                  <span className="text-2xl">{c.icon}</span>
                  <span className="text-xs font-medium">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!title.trim()}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Decision
          </button>
        </form>
      </BottomSheet>
    </div>
  )
}

function DecisionCard({ decision, index, navigate }) {
  const cat = categories.find((c) => c.value === decision.category) || categories[5]
  const status = statusConfig[decision.status]

  return (
    <button
      onClick={() => navigate(`/decision/${decision.id}`)}
      className={`w-full text-left card-elevated p-4 animate-slide-up stagger-${Math.min(index + 1, 5)}`}
      style={{ opacity: 0 }}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${cat.color} rounded-xl flex items-center justify-center text-2xl`}>
          {cat.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{decision.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`badge ${status.class}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot} mr-1.5`} />
              {status.label}
            </span>
            <span className="text-xs text-gray-400">
              {formatDate(decision.createdAt)}
            </span>
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
