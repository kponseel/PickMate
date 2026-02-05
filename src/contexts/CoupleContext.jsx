import { createContext, useContext, useEffect, useState } from 'react'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'

const CoupleContext = createContext(null)

export function useCouple() {
  const ctx = useContext(CoupleContext)
  if (!ctx) throw new Error('useCouple must be used within CoupleProvider')
  return ctx
}

export function CoupleProvider({ children }) {
  const { user } = useAuth()
  const [couple, setCouple] = useState(null)
  const [partner, setPartner] = useState(null)
  const [loading, setLoading] = useState(true)

  // Listen to user doc for coupleId changes
  useEffect(() => {
    if (!user) {
      setCouple(null)
      setPartner(null)
      setLoading(false)
      return
    }

    const unsub = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      const userData = snap.data()
      if (userData?.coupleId) {
        // Listen to couple doc
        const coupleSnap = await getDoc(doc(db, 'couples', userData.coupleId))
        if (coupleSnap.exists()) {
          const coupleData = { id: coupleSnap.id, ...coupleSnap.data() }
          setCouple(coupleData)
          // Load partner info
          const partnerId = coupleData.members.find((id) => id !== user.uid)
          if (partnerId) {
            const partnerSnap = await getDoc(doc(db, 'users', partnerId))
            setPartner(partnerSnap.exists() ? { id: partnerSnap.id, ...partnerSnap.data() } : null)
          }
        }
      } else {
        setCouple(null)
        setPartner(null)
      }
      setLoading(false)
    })

    return unsub
  }, [user])

  async function createCouple() {
    if (!user) return null
    const coupleRef = doc(collection(db, 'couples'))
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    await setDoc(coupleRef, {
      members: [user.uid],
      inviteCode,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    })

    await updateDoc(doc(db, 'users', user.uid), { coupleId: coupleRef.id })
    return inviteCode
  }

  async function joinCouple(inviteCode) {
    if (!user) return

    // Find couple by invite code
    const q = query(collection(db, 'couples'), where('inviteCode', '==', inviteCode.toUpperCase()))
    const snap = await getDocs(q)
    if (snap.empty) throw new Error('Invalid invite code')

    const coupleDoc = snap.docs[0]
    const coupleData = coupleDoc.data()

    if (coupleData.members.length >= 2) throw new Error('This couple already has two members')
    if (coupleData.members.includes(user.uid)) throw new Error('You are already in this couple')

    await updateDoc(doc(db, 'couples', coupleDoc.id), {
      members: [...coupleData.members, user.uid],
    })
    await updateDoc(doc(db, 'users', user.uid), { coupleId: coupleDoc.id })
  }

  async function leaveCouple() {
    if (!user || !couple) return

    const remaining = couple.members.filter((id) => id !== user.uid)

    if (remaining.length === 0) {
      // Delete couple and all its decisions
      const decisionsSnap = await getDocs(
        query(collection(db, 'decisions'), where('coupleId', '==', couple.id))
      )
      for (const d of decisionsSnap.docs) {
        await deleteDoc(d.ref)
      }
      await deleteDoc(doc(db, 'couples', couple.id))
    } else {
      await updateDoc(doc(db, 'couples', couple.id), { members: remaining })
    }

    await updateDoc(doc(db, 'users', user.uid), { coupleId: null })
  }

  return (
    <CoupleContext.Provider value={{ couple, partner, loading, createCouple, joinCouple, leaveCouple }}>
      {children}
    </CoupleContext.Provider>
  )
}
