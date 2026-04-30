import { onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

export async function loginWithGoogle(): Promise<UserProfile | null> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const userRef = doc(db, "users", user.uid);
  let userSnap;
  try {
    userSnap = await getDoc(userRef);
  } catch (error) {
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
      handleFirestoreError(error, OperationType.WRITE, "users/" + user.uid);
    }
    return newUser;
  }

  return userSnap.data() as UserProfile;
}

export function subscribeToAuth(callback: (user: any) => void) {
  return onAuthStateChanged(auth, callback);
}
