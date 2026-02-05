import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDecisions } from '../hooks/useDecisions'
import { useProposals } from '../hooks/useProposals'
import { useRatings } from '../hooks/useRatings'
import ProposalCard from '../components/ProposalCard'
import ResultsView from '../components/ResultsView'

export default function DecisionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { decisions, updateDecisionStatus, deleteDecision } = useDecisions()
  const { proposals, loading: loadingProposals, addProposal, removeProposal } = useProposals(id)
  const { setRating, getUserRating, getResults } = useRatings(id)

  const decision = decisions.find((d) => d.id === id)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', url: '', imageUrl: '', price: '' })
  const [tab, setTab] = useState('proposals') // 'proposals' | 'results'

  if (!decision) {
    return <div className="text-center py-12 text-gray-400">Decision not found</div>
  }

  const isOpen = decision.status === 'open'
  const results = getResults(proposals)

  async function handleAddProposal(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    if (proposals.length >= 5) return
    await addProposal(form)
    setForm({ title: '', description: '', url: '', imageUrl: '', price: '' })
    setShowForm(false)
  }

  async function handleStatusChange(status) {
    await updateDecisionStatus(id, status)
  }

  async function handleDelete() {
    if (window.confirm('Delete this decision and all its proposals?')) {
      await deleteDecision(id)
      navigate('/')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/')} className="text-rose-600 font-medium text-sm">
          ← Back
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900">{decision.title}</h2>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            decision.status === 'open' ? 'bg-green-100 text-green-700' :
            decision.status === 'closed' ? 'bg-gray-100 text-gray-600' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {decision.status}
          </span>
          {isOpen && (
            <>
              <button onClick={() => handleStatusChange('closed')} className="text-xs text-gray-500 underline">
                Close voting
              </button>
              <button onClick={handleDelete} className="text-xs text-red-500 underline">
                Delete
              </button>
            </>
          )}
          {decision.status === 'closed' && (
            <>
              <button onClick={() => handleStatusChange('open')} className="text-xs text-gray-500 underline">
                Reopen
              </button>
              <button onClick={() => handleStatusChange('archived')} className="text-xs text-gray-500 underline">
                Archive
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('proposals')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === 'proposals' ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          Proposals ({proposals.length}/5)
        </button>
        <button
          onClick={() => setTab('results')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === 'results' ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          Results
        </button>
      </div>

      {tab === 'proposals' && (
        <div className="space-y-3">
          {/* Add proposal */}
          {isOpen && proposals.length < 5 && (
            <>
              {showForm ? (
                <form onSubmit={handleAddProposal} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                  <input
                    type="text"
                    placeholder="Proposal title *"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    maxLength={100}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={300}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                  <input
                    type="url"
                    placeholder="Link URL (optional)"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                  <input
                    type="url"
                    placeholder="Image URL (optional)"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Price (optional, e.g. €49)"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 transition-colors"
                    >
                      Add proposal
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-3 text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-rose-300 hover:text-rose-500 transition-colors text-sm font-medium"
                >
                  + Add a proposal
                </button>
              )}
            </>
          )}

          {/* Proposal list */}
          {loadingProposals ? (
            <div className="text-center py-8 text-gray-400 animate-pulse">Loading proposals...</div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No proposals yet. Add the first one!</div>
          ) : (
            proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                userRating={getUserRating(p.id)}
                onRate={(stars) => setRating(p.id, stars)}
                onRemove={isOpen ? () => removeProposal(p.id) : undefined}
                readonly={!isOpen}
              />
            ))
          )}
        </div>
      )}

      {tab === 'results' && <ResultsView results={results} />}
    </div>
  )
}
