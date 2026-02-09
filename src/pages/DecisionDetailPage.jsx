import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'

const categories = {
  food: { icon: '🍕', color: 'bg-orange-50' },
  travel: { icon: '✈️', color: 'bg-blue-50' },
  movie: { icon: '🎬', color: 'bg-purple-50' },
  activity: { icon: '🎯', color: 'bg-green-50' },
  shopping: { icon: '🛍️', color: 'bg-pink-50' },
  other: { icon: '💡', color: 'bg-gray-50' },
}

export default function DecisionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()

  const [decision, setDecision] = useState(null)
  const [options, setOptions] = useState([])
  const [voters, setVoters] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const shareUrl = `${window.location.origin}/vote/${id}`

  // Load decision data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get decision
        const decisionDoc = await getDoc(doc(db, 'decisions', id))
        if (!decisionDoc.exists()) {
          setDecision(null)
          setLoading(false)
          return
        }
        setDecision({ id: decisionDoc.id, ...decisionDoc.data() })

        // Get options
        const optionsSnap = await getDocs(
          query(collection(db, 'decisions', id, 'options'), orderBy('order'))
        )
        const optionsList = optionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setOptions(optionsList)

        // Get voters and their ratings
        const votersSnap = await getDocs(collection(db, 'decisions', id, 'voters'))
        const votersList = []
        for (const voterDoc of votersSnap.docs) {
          const ratingsSnap = await getDocs(collection(voterDoc.ref, 'ratings'))
          const ratings = {}
          ratingsSnap.docs.forEach((r) => {
            ratings[r.id] = r.data().stars
          })
          votersList.push({
            id: voterDoc.id,
            ...voterDoc.data(),
            ratings,
          })
        }
        setVoters(votersList)
      } catch (err) {
        console.error('Error loading decision:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  // Calculate results
  const getResults = () => {
    return options
      .map((opt) => {
        let totalStars = 0
        let voterCount = 0
        voters.forEach((v) => {
          if (v.ratings[opt.id]) {
            totalStars += v.ratings[opt.id]
            voterCount++
          }
        })
        return {
          ...opt,
          totalStars,
          voterCount,
          avgStars: voterCount > 0 ? totalStars / voterCount : 0,
        }
      })
      .sort((a, b) => b.totalStars - a.totalStars)
  }

  const results = getResults()
  const completedVoters = voters.filter((v) => v.completed).length

  const shareOrCopy = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: decision.title, text: `Vote on "${decision.title}"`, url: shareUrl })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStatusChange = async (status) => {
    await updateDoc(doc(db, 'decisions', id), { status })
    setDecision((prev) => ({ ...prev, status }))
    toast.info(status === 'completed' ? 'Decision completed' : 'Decision reopened')
  }

  const handleDelete = async () => {
    if (window.confirm('Delete this decision and all votes?')) {
      await deleteDoc(doc(db, 'decisions', id))
      toast.success('Decision deleted')
      navigate('/')
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="skeleton h-8 w-32 rounded-lg" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    )
  }

  if (!decision) {
    return (
      <div className="p-4">
        <div className="empty-state py-16">
          <div className="empty-state-icon">🔍</div>
          <h3 className="empty-state-title">Decision not found</h3>
          <button onClick={() => navigate('/')} className="btn-primary mt-4">
            Go back
          </button>
        </div>
      </div>
    )
  }

  // Check ownership
  if (decision.ownerId !== user?.uid) {
    return (
      <div className="p-4">
        <div className="empty-state py-16">
          <div className="empty-state-icon">🔒</div>
          <h3 className="empty-state-title">Access denied</h3>
          <p className="empty-state-text">You don't have permission to view this</p>
        </div>
      </div>
    )
  }

  const cat = categories[decision.category] || categories.other

  return (
    <div className="p-4 pb-24 space-y-4">
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

      {/* Header card */}
      <div className="card-elevated p-5 animate-scale-in">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 ${cat.color} rounded-2xl flex items-center justify-center text-2xl`}>
            {cat.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{decision.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                decision.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {decision.status === 'active' ? 'Active' : 'Completed'}
              </span>
              <span className="text-xs text-gray-500">
                {options.length} options
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Share link card */}
      <div className="card-modern p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share with voters
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-600 truncate"
          />
          <button
            onClick={shareOrCopy}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-rose-500 text-white hover:bg-rose-600'
            }`}
          >
            {copied ? 'Copied!' : navigator.share ? 'Share' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Anyone with this link can vote
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-modern p-4 text-center">
          <div className="text-3xl font-bold text-rose-600">{completedVoters}</div>
          <div className="text-sm text-gray-500">Votes received</div>
        </div>
        <div className="card-modern p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{options.length}</div>
          <div className="text-sm text-gray-500">Options</div>
        </div>
      </div>

      {/* Results */}
      <div className="card-modern p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Results</h3>

        {results.length === 0 ? (
          <div className="empty-state py-8">
            <div className="empty-state-icon">📊</div>
            <p className="empty-state-text">No options added yet</p>
          </div>
        ) : completedVoters === 0 ? (
          <div className="empty-state py-8">
            <div className="empty-state-icon">⏳</div>
            <h3 className="empty-state-title">Waiting for votes</h3>
            <p className="empty-state-text">Share the link to start collecting votes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((opt, i) => {
              const maxStars = Math.max(...results.map((r) => r.totalStars), 1)
              const percentage = (opt.totalStars / maxStars) * 100

              return (
                <div key={opt.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                    {i === 0 && opt.totalStars > 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{opt.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">
                        {opt.avgStars.toFixed(1)} avg
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">{opt.totalStars}</span>
                    <span className="text-xs text-gray-400 ml-1">stars</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Options list */}
      <div className="card-modern p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Options ({options.length})</h3>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={opt.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
              {opt.imageUrl ? (
                <img src={opt.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                  {i + 1}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{opt.title}</p>
                {opt.price && <p className="text-sm text-rose-600">{opt.price}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {decision.status === 'active' ? (
          <button
            onClick={() => handleStatusChange('completed')}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Complete Decision
          </button>
        ) : (
          <button
            onClick={() => handleStatusChange('active')}
            className="flex-1 py-3 bg-rose-50 text-rose-600 rounded-xl font-medium hover:bg-rose-100 transition-colors"
          >
            Reopen Decision
          </button>
        )}
        <button
          onClick={handleDelete}
          className="py-3 px-4 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
