import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Room, Scene } from '../types';
import { manualRetryGeneration } from '../services/roomService';
import { format } from 'date-fns';

export function useRoomData(roomId: string, today: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const resumingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubRoom = onSnapshot(doc(db, "rooms", roomId), (sn) => {
      if (sn.exists()) setRoom(sn.data() as Room);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`);
    });

    const q = query(
      collection(db, "rooms", roomId, "scenes"),
      where("date", "==", today),
      orderBy("index", "asc")
    );

    const unsubScenes = onSnapshot(q, (sn) => {
      const data = sn.docs.map(d => d.data() as Scene);
      setScenes(data);
      setLoading(false);
      
      // Only retry if it's the current date and we have energy
      if (today === format(new Date(), 'yyyy-MM-dd')) {
        data.forEach(scene => {
          const shouldRetry = (scene.imageType === 'placeholder' || scene.needsRetry) && !resumingRef.current.has(scene.id);
          if (shouldRetry) {
            resumingRef.current.add(scene.id);
            setTimeout(() => {
              manualRetryGeneration(roomId, scene.id).finally(() => {
                setTimeout(() => {
                  resumingRef.current.delete(scene.id);
                }, 60000 * 5); // 5 min cooldown to avoid spam
              });
            }, 3000);
          }
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/scenes`);
      setLoading(false);
    });

    return () => {
      unsubRoom();
      unsubScenes();
    };
  }, [roomId, today, auth.currentUser?.uid]);

  return { room, scenes, loading };
}
