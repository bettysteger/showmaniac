import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyBUaXTM6-Y_ZbQlY_XbVye_Lfs8euJBqGI",
  authDomain: "showmaniac.firebaseapp.com",
  databaseURL: "https://showmaniac.firebaseio.com",
  projectId: "project-1750918656083837558",
  storageBucket: "project-1750918656083837558.firebasestorage.app",
  messagingSenderId: "2594055492",
  appId: "1:2594055492:web:cfc85bb288ba6f8690a311"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication
const auth = getAuth(app)

// Initialize Realtime Database
const db = getDatabase(app)

// Set persistence to local
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Auth persistence error:", error)
  })

export { auth, db }