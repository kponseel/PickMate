import { useEffect, useState, useCallback } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  doc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export function useRatings(decisionId) {
  const { user } = useAuth()
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!decisionId) {
      setRatings([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'ratings'),
      where('decisionId', '==', decisionId)
    )

    const unsub = onSnapshot(q, (snap) => {
      setRatings(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })

    return unsub
  }, [decisionId])

  const setRating = useCallback(async (proposalId, stars) => {
    if (!user || !decisionId) return
    // Use composite key: `${decisionId}_${proposalId}_${userId}` for one vote per user per proposal
    const ratingId = `${decisionId}_${proposalId}_${user.uid}`
    await setDoc(doc(db, 'ratings', ratingId), {
      decisionId,
      proposalId,
      userId: user.uid,
      stars, // 1, 2, or 3
      updatedAt: new Date().toISOString(),
    })
  }, [user, decisionId])

  // Get the current user's rating for a specific proposal
  function getUserRating(proposalId) {
    if (!user) return 0
    const r = ratings.find((r) => r.proposalId === proposalId && r.userId === user.uid)
    return r ? r.stars : 0
  }

  // Calculate results for all proposals
  function getResults(proposals) {
    return proposals
      .map((p) => {
        const proposalRatings = ratings.filter((r) => r.proposalId === p.id)
        const totalStars = proposalRatings.reduce((sum, r) => sum + r.stars, 0)
        const voterCount = proposalRatings.length
        const avgStars = voterCount > 0 ? totalStars / voterCount : 0
        return {
          ...p,
          totalStars,
          voterCount,
          avgStars,
        }
      })
      .sort((a, b) => b.totalStars - a.totalStars)
  }

  return { ratings, loading, setRating, getUserRating, getResults }
}
