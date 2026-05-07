import { useState, useEffect, ChangeEvent } from 'react';
import { Scene } from '../types';
import { auth } from '../lib/firebase';
import { StoryBook } from './StoryBook';
import { RoomMenu } from './RoomMenu';
import { RoomSettings } from './RoomSettings';
import { addScene, deleteRoom, manualRetryGeneration } from '../services/roomService';
import { moderateText } from '../lib/utils';
import { compressImage, uploadImage } from '../utils/imageUtils';
import { format, addHours, isWithinInterval } from 'date-fns';
import { AnimatePresence } from 'motion/react';
import { useToast } from './Toast';
import { getRemainingUsage } from '../services/userService';

// Hooks
import { useRoomData } from '../hooks/useRoomData';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';

// Components
import { RoomHeader } from './room/RoomHeader';
import { StoryPreview } from './room/StoryPreview';
import { SceneGrid } from './room/SceneGrid';
import { SceneInputModal } from './room/SceneInputModal';

export function RoomView({ roomId, onBack, onOpenArchive }: { roomId: string, onBack: () => void, onOpenArchive: () => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { room, scenes } = useRoomData(roomId, today);
  const { isRecording, countdown, startListening } = useVoiceRecognition((text) => setNewText(text));
  
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showStory, setShowStory] = useState(false);
  const [storyStartIndex, setStoryStartIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [remainingEnergy, setRemainingEnergy] = useState<number | null>(null);
  const { setToast } = useToast();

  useEffect(() => {
    getRemainingUsage().then(setRemainingEnergy);
  }, []);

  const checkTimeWindow = () => {
    if (!room) return false;
    const [h, m] = room.dailyTime.split(':').map(Number);
    const now = new Date();
    const start = new Date(now);
    start.setHours(h, m, 0, 0);
    const end = addHours(start, 4);
    return isWithinInterval(now, { start, end });
  };

  const isActive = checkTimeWindow();

  const handleDeleteRoom = async () => {
    try {
      await deleteRoom(roomId, auth.currentUser!.uid);
      onBack();
    } catch (err: any) {
      setError(err.message || '삭제 실패');
    }
  };

  const handleRetry = async (sceneId: string) => {
    try {
      await manualRetryGeneration(roomId, sceneId);
      getRemainingUsage().then(setRemainingEnergy);
    } catch (err: any) {
      if (err.message === 'DAILY_LIMIT_EXCEEDED') {
        setToast({ 
          message: "오늘의 상상력 에너지를 다 썼어요! 내일 다시 만나요. (일일 15회 제한)", 
          type: "error" 
        });
      } else {
        setToast({ message: "그림을 다시 받는 데 실패했어요.", type: "error" });
      }
    }
  };

  const handleSubmit = async (manualImageUrl?: string) => {
    if ((!newText && !manualImageUrl) || activeSlot === null) return;
    setLoading(true);
    setError('');
    
    try {
      const truncatedText = newText.length > 200 ? newText.substring(0, 197) + "..." : newText;
      const moderated = truncatedText ? moderateText(truncatedText) : "직접 올린 사진이에요.";
      await addScene(roomId, auth.currentUser!.uid, moderated, activeSlot, manualImageUrl);
      getRemainingUsage().then(setRemainingEnergy);
      setActiveSlot(null);
      setNewText('');
    } catch (err: any) {
      const isKnownError = err.message && (
        err.message.includes("transactions require all reads") || 
        err.message.includes("permission") ||
        err.message.includes("이미 해당 장면이 작성되었어요.")
      );

      if (isKnownError) {
        setError("앗! 스케치북을 다 썼어요. 금방 다시 사올게요. 다시 시도해주세요.");
        setTimeout(() => {
          setActiveSlot(null);
          setError('');
        }, 3000);
      } else {
        setError(err.message || '저장 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeSlot === null) return;

    setIsUploading(true);
    setError('');
    try {
      const compressedBlob = await compressImage(file, 0.6, 800);
      const imageUrl = await uploadImage(compressedBlob, "manual");
      await handleSubmit(imageUrl);
    } catch (err: any) {
      setError(err.message || "이미지 업로드 실패");
    } finally {
      setIsUploading(false);
    }
  };

  if (!room) return null;

  return (
    <div className="space-y-8 pb-32 relative">
      <RoomHeader 
        room={room} 
        isActive={isActive} 
        remainingEnergy={remainingEnergy} 
        onBack={onBack} 
        onMenuClick={() => setShowMenu(true)} 
      />

      <StoryPreview 
        sceneCount={scenes.length} 
        onClick={() => setShowStory(true)} 
      />

      <SceneGrid 
        scenes={scenes}
        isActive={isActive}
        onSlotClick={setActiveSlot}
        onSceneClick={(idx) => {
          setStoryStartIndex(idx);
          setShowStory(true);
        }}
        onRetry={handleRetry}
      />

      <AnimatePresence>
        {activeSlot !== null && (
          <SceneInputModal 
            slotIndex={activeSlot}
            text={newText}
            onTextChange={setNewText}
            onClose={() => setActiveSlot(null)}
            onSubmit={() => handleSubmit()}
            onVoiceInput={startListening}
            onFileUpload={handleFileUpload}
            isRecording={isRecording}
            countdown={countdown}
            isUploading={isUploading}
            loading={loading}
            error={error}
          />
        )}

        {showMenu && (
          <RoomMenu 
            room={room} 
            onClose={() => setShowMenu(false)} 
            onDelete={handleDeleteRoom}
            onNavigate={(view) => {
              setShowMenu(false);
              if (view === 'settings') setShowSettings(true);
              if (view === 'archive') onOpenArchive();
            }}
          />
        )}

        {showSettings && (
          <RoomSettings 
            room={room} 
            onClose={() => setShowSettings(false)} 
          />
        )}

        {showStory && (
          <StoryBook 
            scenes={scenes} 
            startIndex={storyStartIndex} 
            onClose={() => setShowStory(false)} 
            onRetry={handleRetry}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
