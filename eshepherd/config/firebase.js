// Firebase configuration
// Note: firebase is loaded globally via script tags in index.html
export const firebaseConfig = {
  apiKey: "AIzaSyAd9QCOrxuVFD3I-kmyY4-ZvNRCSibdb8I",
  authDomain: "charisfriends-54cf3.firebaseapp.com",
  databaseURL: "https://charisfriends-54cf3.firebaseio.com",
  projectId: "charisfriends-54cf3",
  storageBucket: "charisfriends-54cf3.firebasestorage.app",
  messagingSenderId: "12705856594",
  appId: "1:12705856594:web:a4bafa9cbaf7423690738b"
};

// Initialize Firebase (if not already initialized)
// firebase is available globally from script tags loaded before this module
if (typeof firebase !== 'undefined') {
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }
} else {
  // Fallback if firebase not loaded (shouldn't happen in normal flow)
  console.error('Firebase not loaded! Make sure Firebase SDK scripts are loaded before this module.');
}

// Export auth and database (firebase should be available from script tags)
export const auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
export const database = typeof firebase !== 'undefined' ? firebase.database() : null;

