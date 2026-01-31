// Firebase Initialization - ES Module
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-analytics.js';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDqPJRUFWMISu6sxiN1XViu0y373uw64LI",
  authDomain: "smarttax-pos-a1348.firebaseapp.com",
  projectId: "smarttax-pos-a1348",
  storageBucket: "smarttax-pos-a1348.firebasestorage.app",
  messagingSenderId: "750290725178",
  appId: "1:750290725178:web:e9e6b63484e4ae7c0dc803",
  measurementId: "G-HW8JMVCKX3"
};

// Initialize Firebase (only once)
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export auth and db instances
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log('Firebase initialized successfully');
