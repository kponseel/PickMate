import { useEffect, useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { db } from '../firebase'

export function useProposals(decisionId) {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!decisionId) {
      setProposals([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'proposals'),
      where('decisionId', '==', decisionId),
      orderBy('createdAt', 'asc')
    )

    const unsub = onSnapshot(q, (snap) => {
      setProposals(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })

    return unsub
  }, [decisionId])

  async function addProposal({ title, description, url, imageUrl, price }) {
    if (!decisionId) return
    return addDoc(collection(db, 'proposals'), {
      decisionId,
      title,
      description: description || '',
      url: url || '',
      imageUrl: imageUrl || '',
      price: price || '',
      createdAt: new Date().toISOString(),
    })
  }

  async function removeProposal(proposalId) {
    await deleteDoc(doc(db, 'proposals', proposalId))
  }

  return { proposals, loading, addProposal, removeProposal }
}
