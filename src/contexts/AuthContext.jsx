import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
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
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    let mounted = true

    // Handle redirect result from Google sign-in
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth)
        if (result?.user && mounted) {
          console.log('Redirect sign-in successful:', result.user.email)
        }
      } catch (error) {
        console.error('Redirect result error:', error)
        if (mounted) {
          setAuthError(error.message)
          setLoading(false)
        }
      }
    }

    handleRedirectResult()

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return

      if (firebaseUser) {
        try {
          // Ensure user doc exists in Firestore
          const userRef = doc(db, 'users', firebaseUser.uid)
          const snap = await getDoc(userRef)

          if (!snap.exists()) {
            await setDoc(userRef, {
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              createdAt: serverTimestamp(),
            })
          }

          setUser(firebaseUser)
          setAuthError(null)
        } catch (error) {
          console.error('Error setting up user:', error)
          // Still set the user even if Firestore fails
          setUser(firebaseUser)
        }
      } else {
        setUser(null)
      }

      setLoading(false)
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  async function signup(email, password, displayName) {
    setAuthError(null)
    const cred = await createUserWithEmailAndPassword(auth, email, password)

    if (displayName) {
      await updateProfile(cred.user, { displayName })
    }

    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      displayName: displayName || '',
      createdAt: serverTimestamp(),
    })

    return cred.user
  }

  async function login(email, password) {
    setAuthError(null)
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  }

  async function loginWithGoogle() {
    setAuthError(null)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({
      prompt: 'select_account'
    })
    await signInWithRedirect(auth, provider)
  }

  async function logout() {
    await signOut(auth)
    setUser(null)
  }

  const value = {
    user,
    loading,
    authError,
    signup,
    login,
    loginWithGoogle,
    logout,
    clearError: () => setAuthError(null),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
