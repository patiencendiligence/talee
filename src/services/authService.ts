import { onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

export async function loginWithGoogle(): Promise<UserProfile | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    let userSnap;
    try {
      userSnap = await getDoc(userRef);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      handleFirestoreError(error, OperationType.GET, "users/" + user.uid);
      return null;
    }

    if (!userSnap.exists()) {
      const newUser: UserProfile = {
        uid: user.uid,
        nickname: user.displayName || "익명",
        roomIds: []
      };
      try {
        await setDoc(userRef, newUser);
      } catch (error) {
        console.error("Error creating user profile:", error);
        handleFirestoreError(error, OperationType.WRITE, "users/" + user.uid);
      }
      return newUser;
    }

    return userSnap.data() as UserProfile;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.warn("User closed the login popup.");
    } else {
      console.error("Firebase Login Error:", {
        code: error.code,
        message: error.message,
        stack: error.stack,
        browser: navigator.userAgent
      });
    }
    throw error;
  }
}

export function subscribeToAuth(callback: (user: any) => void) {
  return onAuthStateChanged(auth, callback);
}
