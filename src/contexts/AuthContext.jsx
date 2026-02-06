import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Ensure user doc exists in Firestore
        const userRef = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(userRef)
        if (!snap.exists()) {
          await setDoc(userRef, {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || '',
            coupleId: null,
            createdAt: new Date().toISOString(),
          })
        }
        setUser(firebaseUser)
      } else {
        setUser(null)
      }
      setLoading(false)
    })
  }, [])

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    return result.user
  }

  async function logout() {
    await signOut(auth)
  }

  const value = { user, loading, loginWithGoogle, logout }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
