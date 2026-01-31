// Authentication Module - ES Module
import { signInWithEmailAndPassword, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js';
import { auth } from './firebase.js';

// Login function exposed globally
window.login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Login successful:', userCredential.user.email);
    
    // Redirect to POS page after successful login
    setTimeout(() => {
      window.location.href = 'pos.html';
    }, 500);
  } catch (error) {
    console.error('Login error:', error.message);
    throw error;
  }
};

// Google Login function exposed globally
window.loginWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    console.log('Google Login successful:', userCredential.user.email);
    
    // Redirect to POS page after successful login
    setTimeout(() => {
      window.location.href = 'pos.html';
    }, 500);
  } catch (error) {
    console.error('Google Login error:', error.message);
    throw error;
  }
};

// Monitor auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('User is logged in:', user.email);
  } else {
    console.log('User is logged out');
  }
});

// Logout function
window.logout = async () => {
  try {
    await auth.signOut();
    console.log('Logout successful');
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Logout error:', error.message);
  }
};

// Get current user
window.getCurrentUser = () => {
  return auth.currentUser;
};
