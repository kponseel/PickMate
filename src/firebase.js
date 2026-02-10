import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBIMZc_qhO3A95PhK8XyuR9tmE83KlY76o',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pickmate-123c1.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pickmate-123c1',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pickmate-123c1.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '531639402226',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:531639402226:web:68f8937acedfd179379a6b',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-EXJFV57J9T',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
