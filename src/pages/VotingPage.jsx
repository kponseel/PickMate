import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

// Get or create voter ID
const getVoterId = () => {
  let id = localStorage.getItem('pickmate-voter-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('pickmate-voter-id', id)
  }
  return id
}

export default function VotingPage() {
  const { id: decisionId } = useParams()
  const navigate = useNavigate()
  const voterId = getVoterId()

  const [decision, setDecision] = useState(null)
  const [options, setOptions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [swipeDirection, setSwipeDirection] = useState(null)

  const cardRef = useRef(null)
  const startX = useRef(0)
  const currentX = useRef(0)

  // Load decision and options
  useEffect(() => {
    const loadData = async () => {
      try {
        const decisionDoc = await getDoc(doc(db, 'decisions', decisionId))
        if (!decisionDoc.exists()) {
          setError('Decision not found')
          return
        }
        setDecision({ id: decisionDoc.id, ...decisionDoc.data() })

        const optionsSnap = await getDocs(collection(db, 'decisions', decisionId, 'options'))
        const optionsList = optionsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order || 0) - (b.order || 0))
        setOptions(optionsList)

        // Load existing ratings
        const ratingsSnap = await getDocs(
          collection(db, 'decisions', decisionId, 'voters', voterId, 'ratings')
        )
        const existingRatings = {}
        ratingsSnap.docs.forEach((d) => {
          existingRatings[d.id] = d.data().stars
        })
        setRatings(existingRatings)
      } catch (err) {
        console.error('Error loading decision:', err)
        setError('Failed to load decision')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [decisionId, voterId])

  const currentOption = options[currentIndex]

  const saveRating = async (optionId, stars) => {
    setRatings((prev) => ({ ...prev, [optionId]: stars }))
    try {
      // Ensure voter doc exists
      await setDoc(
        doc(db, 'decisions', decisionId, 'voters', voterId),
        { createdAt: serverTimestamp(), completed: false },
        { merge: true }
      )
      // Save rating
      await setDoc(
        doc(db, 'decisions', decisionId, 'voters', voterId, 'ratings', optionId),
        { stars, ratedAt: serverTimestamp() }
      )
    } catch (err) {
      console.error('Error saving rating:', err)
    }
  }

  const goNext = async () => {
    if (currentIndex < options.length - 1) {
      setSwipeDirection('left')
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1)
        setSwipeDirection(null)
      }, 200)
    } else {
      // Mark as completed and go to done page
      await setDoc(
        doc(db, 'decisions', decisionId, 'voters', voterId),
        { completed: true },
        { merge: true }
      )
      navigate(`/vote/${decisionId}/done`)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setSwipeDirection('right')
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1)
        setSwipeDirection(null)
      }, 200)
    }
  }

  // Touch handlers
  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX
    currentX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e) => {
    currentX.current = e.touches[0].clientX
    const diff = currentX.current - startX.current
    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${diff}px) rotate(${diff * 0.05}deg)`
    }
  }

  const handleTouchEnd = () => {
    const diff = currentX.current - startX.current
    if (cardRef.current) {
      cardRef.current.style.transform = ''
    }
    if (diff > 80) {
      goPrev()
    } else if (diff < -80) {
      goNext()
    }
    startX.current = 0
    currentX.current = 0
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex gap-1">
          <span className="w-3 h-3 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-3 h-3 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-3 h-3 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{error}</h1>
          <p className="text-gray-500">This link may be invalid or expired</p>
        </div>
      </div>
    )
  }

  if (options.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">📭</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">No options yet</h1>
          <p className="text-gray-500">The owner hasn't added any options</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 flex flex-col">
      {/* Header */}
      <div className="p-4 text-center">
        <h1 className="text-lg font-bold text-gray-900">{decision?.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {currentIndex + 1} of {options.length}
        </p>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-white/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-500 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / options.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          ref={cardRef}
          className={`w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden transition-all duration-200 ${
            swipeDirection === 'left' ? 'animate-swipe-left' : ''
          } ${swipeDirection === 'right' ? 'animate-swipe-right' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Image */}
          {currentOption?.imageUrl ? (
            <div className="h-64 bg-gray-100">
              <img
                src={currentOption.imageUrl}
                alt={currentOption.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="h-48 bg-gradient-to-br from-rose-100 to-orange-100 flex items-center justify-center">
              <span className="text-6xl">🎯</span>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-gray-900">{currentOption?.title}</h2>
              {currentOption?.price && (
                <span className="shrink-0 bg-rose-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  {currentOption.price}
                </span>
              )}
            </div>

            {currentOption?.description && (
              <p className="mt-2 text-gray-600">{currentOption.description}</p>
            )}

            {currentOption?.url && (
              <a
                href={currentOption.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-rose-600 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View details
              </a>
            )}

            {/* Star rating */}
            <div className="mt-6 flex justify-center">
              <div className="star-rating">
                {[1, 2, 3].map((star) => (
                  <button
                    key={star}
                    onClick={() => saveRating(currentOption.id, star)}
                    className={`star text-4xl ${
                      star <= (ratings[currentOption?.id] || 0) ? 'filled' : 'empty'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <p className="text-center text-sm text-gray-400 mt-2">
              {ratings[currentOption?.id] ? 'Tap to change' : 'Tap to rate'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 flex items-center justify-center gap-4">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={goNext}
          className="w-16 h-16 rounded-full bg-rose-500 shadow-lg flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
        >
          {currentIndex === options.length - 1 ? (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Swipe hint */}
      <p className="text-center text-xs text-gray-400 pb-4 safe-bottom">
        Swipe or tap arrows to navigate
      </p>
    </div>
  )
}
