import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

export interface UserUsage {
  dailyCount: number;
  lastReset: any;
}

const MAX_DAILY_GENERATIONS = 15; // 하루 최대 생성 횟수
const ADMIN_EMAIL = "patiencendiligence@gmail.com";

export async function checkAndIncrementUsage(): Promise<{ allowed: boolean; remaining: number }> {
  const user = auth.currentUser;
  if (!user) return { allowed: false, remaining: 0 };

  // Admin bypass
  if (user.email === ADMIN_EMAIL) {
    return { allowed: true, remaining: 999 };
  }

  const usageRef = doc(db, 'user_usage', user.uid);
  const usageSnap = await getDoc(usageRef);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (!usageSnap.exists()) {
    await setDoc(usageRef, {
      dailyCount: 1,
      lastReset: today,
      updatedAt: serverTimestamp()
    });
    return { allowed: true, remaining: MAX_DAILY_GENERATIONS - 1 };
  }

  const data = usageSnap.data();
  
  if (data.lastReset !== today) {
    // 날짜가 바뀌었으면 초기화
    await updateDoc(usageRef, {
      dailyCount: 1,
      lastReset: today,
      updatedAt: serverTimestamp()
    });
    return { allowed: true, remaining: MAX_DAILY_GENERATIONS - 1 };
  }

  if (data.dailyCount >= MAX_DAILY_GENERATIONS) {
    return { allowed: false, remaining: 0 };
  }

  // 횟수 증가
  await updateDoc(usageRef, {
    dailyCount: increment(1),
    updatedAt: serverTimestamp()
  });

  return { allowed: true, remaining: MAX_DAILY_GENERATIONS - (data.dailyCount + 1) };
}

export async function getRemainingUsage(): Promise<number> {
  const user = auth.currentUser;
  if (!user) return 0;

  const usageRef = doc(db, 'user_usage', user.uid);
  const usageSnap = await getDoc(usageRef);

  if (!usageSnap.exists()) return MAX_DAILY_GENERATIONS;

  const data = usageSnap.data();
  const today = new Date().toISOString().split('T')[0];

  if (data.lastReset !== today) return MAX_DAILY_GENERATIONS;
  
  return Math.max(0, MAX_DAILY_GENERATIONS - data.dailyCount);
}
