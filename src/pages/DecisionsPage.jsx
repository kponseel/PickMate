import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCouple } from '../contexts/CoupleContext'
import { useDecisions } from '../hooks/useDecisions'

const categories = [
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'food', label: 'Food', icon: '🍽️' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'activity', label: 'Activity', icon: '🎯' },
  { value: 'movie', label: 'Movie', icon: '🎬' },
  { value: 'other', label: 'Other', icon: '💡' },
]

const statusColors = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  archived: 'bg-yellow-100 text-yellow-700',
}

export default function DecisionsPage() {
  const { couple } = useCouple()
  const { decisions, loading, createDecision } = useDecisions()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')

  if (!couple) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">💑</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">No couple yet</h2>
        <p className="text-gray-500 text-sm mb-4">Connect with your partner to start making decisions together.</p>
        <button
          onClick={() => navigate('/couple')}
          className="px-6 py-3 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 transition-colors"
        >
          Set up couple
        </button>
      </div>
    )
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-pulse text-gray-400">Loading...</div></div>
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!title.trim()) return
    await createDecision(title.trim(), category)
    setTitle('')
    setCategory('other')
    setShowForm(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Decisions</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-xl hover:bg-rose-700 active:bg-rose-800 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <input
            type="text"
            placeholder="What are you deciding?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === c.value
                    ? 'bg-rose-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 active:bg-rose-800 transition-colors"
          >
            Create decision
          </button>
        </form>
      )}

      {decisions.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🤔</div>
          <p className="text-gray-500">No decisions yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => {
            const cat = categories.find((c) => c.value === d.category) || categories[5]
            return (
              <button
                key={d.id}
                onClick={() => navigate(`/decision/${d.id}`)}
                className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-rose-200 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{d.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[d.status]}`}>
                        {d.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span className="text-gray-300 text-xl">›</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
