// Authentication Module - ES Module
import { signInWithEmailAndPassword, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js';
import { getDoc, setDoc, doc } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js';
import { auth, db } from './firebase.js';

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
    const user = userCredential.user;
    
    // Check if admin profile exists
    const docRef = doc(db, 'admins', user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log('Google Login successful:', user.email);
      window.location.href = 'pos.html';
    } else {
      // Show registration modal
      const modal = document.getElementById('registrationModal');
      if (modal) {
        modal.style.display = 'flex';
        window.pendingUser = user; // Store user object for registration
      }
    }
  } catch (error) {
    console.error('Google Login error:', error.message);
    throw error;
  }
};

// Complete Registration function
window.completeRegistration = async () => {
  const name = document.getElementById('regName').value;
  const empId = document.getElementById('regEmpId').value;
  const user = window.pendingUser;

  if (!name || !empId) {
    alert('Please fill in all fields');
    return;
  }

  try {
    await setDoc(doc(db, 'admins', user.uid), {
      name: name,
      empId: empId,
      email: user.email,
      uid: user.uid,
      createdAt: new Date()
    });
    window.location.href = 'pos.html';
  } catch (error) {
    console.error('Registration error:', error);
    alert('Error saving profile: ' + error.message);
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
