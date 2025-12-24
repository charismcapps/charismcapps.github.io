// Authentication service
import { auth } from '../config/firebase.js';

export const authService = {
  async signIn() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      return { user: result.user, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, error: 'Sign in failed: ' + error.message };
    }
  },

  async signOut() {
    try {
      await auth.signOut();
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: error.message };
    }
  },

  onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
  }
};

