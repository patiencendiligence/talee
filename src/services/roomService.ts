import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  where,
  getDocs,
  orderBy,
  writeBatch
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { Room, Scene } from "../types";
import { format } from "date-fns";
import { getStoryImage, generatePlaceholderImage } from "./imageService";
import { checkAndIncrementUsage } from './userService';
import { STORY_STYLES } from "../constants";


export async function deleteRoom(roomId: string, userId: string): Promise<void> {
  try {
    const roomSnap = await getDoc(doc(db, "rooms", roomId));
    if (!roomSnap.exists()) return;
    const roomData = roomSnap.data() as Room;

    // 1. Delete all scenes in the room (subcollection)
    const scenesRef = collection(db, "rooms", roomId, "scenes");
    const scenesSnap = await getDocs(scenesRef);
    const batch = writeBatch(db);
    scenesSnap.forEach((sceneDoc) => {
      batch.delete(sceneDoc.ref);
    });
    
    // 2. Delete the room itself
    batch.delete(doc(db, "rooms", roomId));
    
    await batch.commit();

    // 3. Remove room from members' profiles
    for (const memberId of roomData.members) {
      try {
        await updateDoc(doc(db, "users", memberId), {
          roomIds: arrayRemove(roomId)
        });
      } catch (e) {
        console.warn(`Could not remove room from member ${memberId} profile`, e);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `rooms/${roomId}`);
  }
}


export async function createRoom(userId: string, name: string, dailyTime: string, maxMembers: number = 4): Promise<string> {
  const roomId = crypto.randomUUID();
  const room: Room = {
    id: roomId,
    name,
    ownerId: userId,
    members: [userId],
    maxMembers,
    dailyTime,
  };

  try {
    await setDoc(doc(db, "rooms", roomId), room);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${roomId}`);
  }
  
  try {
    await updateDoc(doc(db, "users", userId), {
      roomIds: arrayUnion(roomId)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }

  return roomId;
}

export async function updateRoom(roomId: string, updates: Partial<Room>): Promise<void> {
  try {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${roomId}`);
  }
}

export async function addScene(roomId: string, userId: string, text: string, index: number, manualImageUrl?: string): Promise<void> {
  // Check usage BEFORE starting any work to avoid orphaned documents or confusing states
  const { allowed } = await checkAndIncrementUsage();
  if (!allowed) {
    throw new Error("DAILY_LIMIT_EXCEEDED");
  }

  const dateStr = format(new Date(), "yyyy-MM-dd");
  const sceneId = `${dateStr}_${index}`;
  const roomRef = doc(db, "rooms", roomId);
  const sceneRef = doc(db, "rooms", roomId, "scenes", sceneId);

  try {
    // 1. Create a placeholder image (if NOT manual)
    const placeholderUrl = manualImageUrl || generatePlaceholderImage(text, "스케치북 사오는 중..");

    // 2. Perform transaction
    const result = await runTransaction(db, async (transaction) => {
      // ALL READS AT THE TOP
      const roomSnap = await transaction.get(roomRef);
      const sceneSnap = await transaction.get(sceneRef);

      // LOGIC
      if (!roomSnap.exists()) throw new Error("이야기 방을 찾지 못했어요.");
      if (sceneSnap.exists()) throw new Error("이미 해당 장면이 작성되었어요.");
      
      const roomData = roomSnap.data() as Room;

      // Handle daily style selection
      let todayStyle = roomData.dailyStyles?.[dateStr];
      const needsStyleUpdate = todayStyle === undefined;
      
      if (needsStyleUpdate) {
        todayStyle = Math.floor(Math.random() * STORY_STYLES.length);
      }

      const [targetH, targetM] = roomData.dailyTime.split(':').map(Number);
      const now = new Date();
      const startTime = new Date(now);
      startTime.setHours(targetH, targetM, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 4); // Increased to 4 hours for better usability

      const isAdmin = auth.currentUser?.email === "patiencendiligence@gmail.com";
      const isOwner = userId === roomData.ownerId;

      if (!isAdmin && !isOwner && (now < startTime || now > endTime)) {
        throw new Error("꼬리물기 시간이 아니예요! (지능형 참여 시간 제한 중)");
      }

      const newScene: Scene = {
        id: sceneId,
        roomId,
        date: dateStr,
        index,
        text,
        imageUrl: placeholderUrl,
        imageType: manualImageUrl ? 'manual' : 'placeholder',
        isGenerating: manualImageUrl ? false : true,
        needsRetry: manualImageUrl ? false : true,
        createdBy: userId,
        createdAt: serverTimestamp(),
        members: roomData.members, // DENORMALIZATION for security rules
      };

      // ALL WRITES AT THE BOTTOM
      if (needsStyleUpdate) {
        const newDailyStyles = { ...(roomData.dailyStyles || {}), [dateStr]: todayStyle };
        transaction.update(roomRef, { dailyStyles: newDailyStyles });
      }
      transaction.set(sceneRef, newScene);
      
      return { styleIndex: todayStyle! };
    });

    if (manualImageUrl) return; // Exit if manual image provided

    const styleIndex = result.styleIndex;

    // 3. Start AI image generation in background after transaction succeeds
    const generateBackgroundImageUrl = async () => {
      try {
        const scenesRef = collection(db, "rooms", roomId, "scenes");
        const q = query(scenesRef, where("date", "==", dateStr), orderBy("index", "asc"));
        const snapshot = await getDocs(q);
        const previousScenes = snapshot.docs
          .map(d => d.data() as Scene)
          .filter(s => s.index < index);
        
        const storyContext = previousScenes.length > 0 
          ? "Previous events: " + previousScenes.map(s => s.text).join(". ")
          : "Initial scene of the story.";

        const stylePrompt = STORY_STYLES[styleIndex!].prompt;
        
        try {
          const result = await getStoryImage(text, stylePrompt, storyContext);
          // Use setDoc with merge: true for ultimate safety against "document not found"
          await setDoc(sceneRef, {
            imageUrl: result.imageUrl,
            imageType: result.type,
            isGenerating: false,
            needsRetry: result.type === 'placeholder'
          }, { merge: true });
        } catch (error: any) {
          console.error("AI Generation inner failed:", error);
          await setDoc(sceneRef, {
            isGenerating: false,
            needsRetry: true
          }, { merge: true }).catch(e => console.error("Could not even set failure state:", e));
        }
      } catch (e) {
        console.error("Background task outer error:", e);
        // Ensure state is updated even on fatal outer errors
        try {
          await updateDoc(sceneRef, {
            isGenerating: false,
            needsRetry: true
          });
        } catch (innerE) {
          console.error("Failed to update stuck state:", innerE);
        }
      }
    };

    generateBackgroundImageUrl();

  } catch (error: any) {
    if (error.message === 'DAILY_LIMIT_EXCEEDED') throw error;
    handleFirestoreError(error, OperationType.WRITE, `rooms/${roomId}/scenes/${sceneId}`);
  }
}

export async function manualRetryGeneration(roomId: string, sceneId: string): Promise<void> {
  const sceneRef = doc(db, "rooms", roomId, "scenes", sceneId);
  
  // Check usage for retry too
  const { allowed } = await checkAndIncrementUsage();
  if (!allowed) {
    throw new Error("DAILY_LIMIT_EXCEEDED");
  }

  try {
    // Set to a "ready for retry" state
    await setDoc(sceneRef, {
      isGenerating: true,
      needsRetry: true
    }, { merge: true });
    
    // Trigger logic
    await resumeGeneration(roomId, sceneId);
  } catch (error: any) {
    if (error.message === 'DAILY_LIMIT_EXCEEDED') throw error;
    handleFirestoreError(error, OperationType.WRITE, `rooms/${roomId}/scenes/${sceneId}`);
  }
}

export async function resumeGeneration(roomId: string, sceneId: string): Promise<void> {
  const sceneRef = doc(db, "rooms", roomId, "scenes", sceneId);
  const roomRef = doc(db, "rooms", roomId);

  try {
    const [sceneSnap, roomSnap] = await Promise.all([
      getDoc(sceneRef),
      getDoc(roomRef)
    ]);

    if (!sceneSnap.exists() || !roomSnap.exists()) return;
    
    const sceneData = sceneSnap.data() as Scene;
    const roomData = roomSnap.data() as Room;

    // Allow retry if it's currently generating
    if (!sceneData.isGenerating) return;

    // Build context again
    const scenesRef = collection(db, "rooms", roomId, "scenes");
    const q = query(scenesRef, where("date", "==", sceneData.date), orderBy("index", "asc"));
    const snapshot = await getDocs(q);
    const previousScenes = snapshot.docs
      .map(d => d.data() as Scene)
      .filter(s => s.index < sceneData.index);
    
    const storyContext = previousScenes.length > 0 
      ? "Previous events: " + previousScenes.map(s => s.text).join(". ")
      : "Initial scene of the story.";

    const dailyStyle = roomData.dailyStyles?.[sceneData.date] ?? 0;
    const stylePrompt = STORY_STYLES[dailyStyle].prompt;

    try {
      const result = await getStoryImage(sceneData.text, stylePrompt, storyContext);
      await setDoc(sceneRef, {
        imageUrl: result.imageUrl,
        imageType: result.type,
        isGenerating: false,
        needsRetry: result.type === 'placeholder'
      }, { merge: true });
    } catch (error: any) {
      console.error("AI Generation retry failed:", error);
      await setDoc(sceneRef, {
        isGenerating: false,
        needsRetry: true
      }, { merge: true }).catch(e => console.error("Could not even update retry failure state:", e));
      throw error; // Re-throw for UI to show specific toast (e.g. usage limit)
    }
  } catch (e) {
    console.error("Failed to resume generation fatal error:", e);
    // Try one last time to clear the loading state
    try {
      await setDoc(sceneRef, {
        isGenerating: false,
        needsRetry: true
      }, { merge: true });
    } catch (innerE) {
      console.error("Could not clear stuck state on fatal error:", innerE);
    }
    throw e;
  }
}

export async function getDailyScenes(roomId: string, date: string): Promise<Scene[]> {
  const scenesRef = collection(db, "rooms", roomId, "scenes");
  const q = query(scenesRef, where("date", "==", date), orderBy("index", "asc"));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Scene);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/scenes`);
    return [];
  }
}
