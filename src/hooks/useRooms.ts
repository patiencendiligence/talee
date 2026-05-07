import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Room } from '../types';

export function useRooms(userId: string | undefined) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    // Optimize: Order by lastActiveDate and limit to 24 most recent rooms
    const q = query(
      collection(db, "rooms"), 
      where("members", "array-contains", userId),
      orderBy("lastActiveDate", "desc"),
      limit(24)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRooms(snapshot.docs.map(doc => doc.data() as Room));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "rooms");
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  return { rooms, loading };
}
