import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

export default function VoteDonePage() {
  const { id: decisionId } = useParams()
  const [decision, setDecision] = useState(null)

  useEffect(() => {
    const loadDecision = async () => {
      const decisionDoc = await getDoc(doc(db, 'decisions', decisionId))
      if (decisionDoc.exists()) {
        setDecision({ id: decisionDoc.id, ...decisionDoc.data() })
      }
    }
    loadDecision()
  }, [decisionId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 flex flex-col items-center justify-center p-6">
      {/* Celebration animation */}
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-gradient-to-br from-rose-500 to-orange-500 rounded-full flex items-center justify-center animate-bounce-in">
          <span className="text-5xl">🎉</span>
        </div>
        {/* Confetti dots */}
        <div className="absolute -top-4 -left-4 w-4 h-4 bg-yellow-400 rounded-full animate-ping" />
        <div className="absolute -top-2 right-0 w-3 h-3 bg-rose-400 rounded-full animate-ping" style={{ animationDelay: '200ms' }} />
        <div className="absolute bottom-0 -right-4 w-4 h-4 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '400ms' }} />
        <div className="absolute -bottom-2 left-0 w-3 h-3 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '600ms' }} />
      </div>

      <h1 className="text-3xl font-bold text-gray-900 text-center mb-3 animate-fade-in">
        Thanks for voting!
      </h1>

      <p className="text-gray-600 text-center mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
        Your ratings have been recorded
      </p>

      {decision && (
        <div className="card-modern p-4 mb-8 animate-scale-in" style={{ animationDelay: '200ms' }}>
          <p className="text-sm text-gray-500">You voted on</p>
          <p className="font-semibold text-gray-900">{decision.title}</p>
        </div>
      )}

      <p className="text-sm text-gray-400 text-center animate-fade-in" style={{ animationDelay: '300ms' }}>
        You can close this page now
      </p>

      {/* Optional: vote again link */}
      <a
        href={`/vote/${decisionId}`}
        className="mt-8 text-rose-600 text-sm font-medium hover:underline animate-fade-in"
        style={{ animationDelay: '400ms' }}
      >
        Change my votes
      </a>
    </div>
  )
}
