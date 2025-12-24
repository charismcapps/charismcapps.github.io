// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAd9QCOrxuVFD3I-kmyY4-ZvNRCSibdb8I",
  authDomain: "charisfriends-54cf3.firebaseapp.com",
  databaseURL: "https://charisfriends-54cf3.firebaseio.com",
  projectId: "charisfriends-54cf3",
  storageBucket: "charisfriends-54cf3.firebasestorage.app",
  messagingSenderId: "12705856594",
  appId: "1:12705856594:web:a4bafa9cbaf7423690738b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

