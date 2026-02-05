import { useEffect, useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useCouple } from '../contexts/CoupleContext'

export function useDecisions() {
  const { couple } = useCouple()
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!couple) {
      setDecisions([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'decisions'),
      where('coupleId', '==', couple.id),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      setDecisions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })

    return unsub
  }, [couple])

  async function createDecision(title, category) {
    if (!couple) return
    return addDoc(collection(db, 'decisions'), {
      coupleId: couple.id,
      title,
      category: category || 'other',
      status: 'open',
      createdAt: new Date().toISOString(),
    })
  }

  async function updateDecisionStatus(decisionId, status) {
    await updateDoc(doc(db, 'decisions', decisionId), { status })
  }

  async function deleteDecision(decisionId) {
    await deleteDoc(doc(db, 'decisions', decisionId))
  }

  return { decisions, loading, createDecision, updateDecisionStatus, deleteDecision }
}
