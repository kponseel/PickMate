import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
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
        if (result?.user) {
          console.log('Google sign-in successful:', result.user.email)
        }
      } catch (error) {
        console.error('Redirect error:', error.code, error.message)
        if (mounted) {
          // More user-friendly error messages
          let message = error.message
          if (error.code === 'auth/popup-closed-by-user') {
            message = 'Sign-in was cancelled'
          } else if (error.code === 'auth/network-request-failed') {
            message = 'Network error. Please check your connection.'
          } else if (error.code === 'auth/unauthorized-domain') {
            message = 'This domain is not authorized for sign-in.'
          }
          setAuthError(message)
        }
      }
    }

    handleRedirectResult()

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return

      console.log('Auth state changed:', firebaseUser?.email || 'No user')

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
            console.log('Created user doc')
          }
        } catch (error) {
          // Log but don't block - user can still use the app
          console.error('Error with user doc:', error)
        }

        setUser(firebaseUser)
        setAuthError(null)
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

  async function loginWithGoogle() {
    setAuthError(null)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({
      prompt: 'select_account'
    })
    // This will redirect the page
    await signInWithRedirect(auth, provider)
  }

  async function logout() {
    await signOut(auth)
  }

  const value = {
    user,
    loading,
    authError,
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
