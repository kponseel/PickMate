import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDecisions } from '../hooks/useDecisions'
import { useProposals } from '../hooks/useProposals'
import { useRatings } from '../hooks/useRatings'
import { useToast } from '../components/Toast'
import ProposalCard from '../components/ProposalCard'
import ResultsView from '../components/ResultsView'
import BottomSheet from '../components/BottomSheet'
import { SkeletonProposal } from '../components/Skeleton'

const categories = {
  food: { icon: '🍽️', color: 'bg-orange-50' },
  travel: { icon: '✈️', color: 'bg-blue-50' },
  movie: { icon: '🎬', color: 'bg-purple-50' },
  activity: { icon: '🎯', color: 'bg-green-50' },
  shopping: { icon: '🛍️', color: 'bg-pink-50' },
  other: { icon: '💡', color: 'bg-gray-50' },
}

const statusConfig = {
  open: { label: 'Voting Open', class: 'badge-success', dot: 'bg-green-500' },
  closed: { label: 'Voting Closed', class: 'badge-default', dot: 'bg-gray-400' },
  archived: { label: 'Archived', class: 'badge-warning', dot: 'bg-amber-500' },
}

export default function DecisionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { decisions, updateDecisionStatus, deleteDecision } = useDecisions()
  const { proposals, loading: loadingProposals, addProposal, removeProposal } = useProposals(id)
  const { setRating, getUserRating, getResults } = useRatings(id)

  const decision = decisions.find((d) => d.id === id)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', url: '', imageUrl: '', price: '' })
  const [tab, setTab] = useState('proposals')

  if (!decision) {
    return (
      <div className="empty-state min-h-[60vh]">
        <div className="empty-state-icon">🔍</div>
        <h3 className="empty-state-title">Decision not found</h3>
        <p className="empty-state-text">This decision may have been deleted</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          Go back
        </button>
      </div>
    )
  }

  const cat = categories[decision.category] || categories.other
  const status = statusConfig[decision.status]
  const isOpen = decision.status === 'open'
  const results = getResults(proposals)

  async function handleAddProposal(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    if (proposals.length >= 5) return
    await addProposal(form)
    setForm({ title: '', description: '', url: '', imageUrl: '', price: '' })
    setShowForm(false)
    toast.success('Proposal added!')
  }

  async function handleStatusChange(newStatus) {
    await updateDecisionStatus(id, newStatus)
    toast.info(newStatus === 'closed' ? 'Voting closed' : newStatus === 'open' ? 'Voting reopened' : 'Decision archived')
  }

  async function handleDelete() {
    if (window.confirm('Delete this decision and all its proposals?')) {
      await deleteDecision(id)
      toast.success('Decision deleted')
      navigate('/')
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 font-medium text-sm hover:text-rose-600 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Decision header card */}
      <div className="card-elevated p-5 animate-scale-in">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 ${cat.color} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0`}>
            {cat.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{decision.title}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${status.class}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot} mr-1.5`} />
                {status.label}
              </span>
              <span className="text-xs text-gray-400">
                {proposals.length}/5 proposals
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          {isOpen && (
            <>
              <button
                onClick={() => handleStatusChange('closed')}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Close voting
              </button>
              <button
                onClick={handleDelete}
                className="py-2.5 px-4 text-sm font-medium text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </>
          )}
          {decision.status === 'closed' && (
            <>
              <button
                onClick={() => handleStatusChange('open')}
                className="flex-1 py-2.5 text-sm font-medium text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors"
              >
                Reopen voting
              </button>
              <button
                onClick={() => handleStatusChange('archived')}
                className="py-2.5 px-4 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Archive
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button
          onClick={() => setTab('proposals')}
          className={`tab-item ${tab === 'proposals' ? 'active' : ''}`}
        >
          Proposals ({proposals.length})
        </button>
        <button
          onClick={() => setTab('results')}
          className={`tab-item ${tab === 'results' ? 'active' : ''}`}
        >
          Results
        </button>
      </div>

      {/* Content */}
      {tab === 'proposals' && (
        <div className="space-y-3">
          {/* Add proposal button */}
          {isOpen && proposals.length < 5 && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50/50 transition-all text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add a proposal
            </button>
          )}

          {/* Proposal list */}
          {loadingProposals ? (
            <div className="space-y-3">
              <SkeletonProposal />
              <SkeletonProposal />
            </div>
          ) : proposals.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon">📝</div>
              <h3 className="empty-state-title">No proposals yet</h3>
              <p className="empty-state-text">Add options to vote on</p>
            </div>
          ) : (
            proposals.map((p, i) => (
              <div
                key={p.id}
                className={`animate-slide-up stagger-${Math.min(i + 1, 5)}`}
                style={{ opacity: 0 }}
              >
                <ProposalCard
                  proposal={p}
                  userRating={getUserRating(p.id)}
                  onRate={(stars) => setRating(p.id, stars)}
                  onRemove={isOpen ? () => removeProposal(p.id) : undefined}
                  readonly={!isOpen}
                />
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'results' && <ResultsView results={results} />}

      {/* Bottom Sheet for adding proposal */}
      <BottomSheet
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add Proposal"
      >
        <form onSubmit={handleAddProposal} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
            <input
              type="text"
              placeholder="What's the option?"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              maxLength={100}
              className="input-modern"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              placeholder="Add some details (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={300}
              rows={2}
              className="input-modern resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Link URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="input-modern text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Price</label>
              <input
                type="text"
                placeholder="€49"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input-modern text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Image URL</label>
            <input
              type="url"
              placeholder="https://..."
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="input-modern text-sm"
            />
            {form.imageUrl && (
              <div className="mt-2 h-32 rounded-xl overflow-hidden bg-gray-100">
                <img
                  src={form.imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!form.title.trim()}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Proposal
          </button>
        </form>
      </BottomSheet>
    </div>
  )
}
