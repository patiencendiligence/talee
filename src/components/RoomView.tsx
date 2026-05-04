import { useState, useEffect, ChangeEvent, useRef } from 'react';
import { Room, Scene } from '../types';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { ArrowLeft, Plus, Mic, Image as ImageIcon, CheckCircle2, Clock, BookOpen, MoreVertical, X, Share2, Trash2, Download, Upload, RefreshCcw } from 'lucide-react';
import { StoryBook } from './StoryBook';
import { RoomMenu } from './RoomMenu';
import { RoomSettings } from './RoomSettings';
import { addScene, deleteRoom, resumeGeneration, manualRetryGeneration } from '../services/roomService';
import { moderateText } from '../lib/utils';
import { compressImage, uploadImage, generateImageHash } from '../utils/imageUtils';
import { format, addHours, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export function RoomView({ roomId, onBack, onOpenArchive }: { roomId: string, onBack: () => void, onOpenArchive: () => void }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [newText, setNewText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showStory, setShowStory] = useState(false);
  const [storyStartIndex, setStoryStartIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const resumingRef = useRef<Set<string>>(new Set());

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const unsubRoom = onSnapshot(doc(db, "rooms", roomId), (sn) => {
      if (sn.exists()) setRoom(sn.data() as Room);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`);
    });

    const q = query(
      collection(db, "rooms", roomId, "scenes"),
      where("date", "==", today),
      where("members", "array-contains", auth.currentUser?.uid),
      orderBy("index", "asc")
    );
    const unsubScenes = onSnapshot(q, (sn) => {
      const data = sn.docs.map(d => d.data() as Scene);
      setScenes(data);
      
      // Auto-resume generation for scenes that need retry (placeholders or failed AI attempts)
      data.forEach(scene => {
        const isPlaceholder = scene.imageType === 'placeholder';
        const isStuck = scene.isGenerating && scene.needsRetry;
        
        if ((isPlaceholder || isStuck) && scene.needsRetry && !resumingRef.current.has(scene.id)) {
          // Only auto-retry if some time has passed in the session
          resumingRef.current.add(scene.id);
          
          // Small delay for auto-resuming to avoid UI stutter on mount
          setTimeout(() => {
            manualRetryGeneration(roomId, scene.id).finally(() => {
              // Wait 2 minutes before allowing another auto-trigger for this scene instance
              // to prevent rapid-fire retries on persistent quota issues
              setTimeout(() => {
                if (resumingRef.current.has(scene.id)) {
                  resumingRef.current.delete(scene.id);
                }
              }, 120000); 
            });
          }, 2000);
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/scenes`);
    });

    return () => {
      unsubRoom();
      unsubScenes();
    };
  }, [roomId, today, auth.currentUser?.uid]);

  const checkTimeWindow = () => {
    if (!room) return false;
    const [h, m] = room.dailyTime.split(':').map(Number);
    const now = new Date();
    const start = new Date(now);
    start.setHours(h, m, 0, 0);
    const end = addHours(start, 1);
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

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("말하기 검색이 지원되지 않는 브라우저입니다.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.onstart = () => {
      setIsRecording(true);
      setCountdown(5);
    };
    recognition.onend = () => {
      setIsRecording(false);
      setCountdown(0);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNewText(transcript);
    };

    recognition.start();
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          recognition.stop();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRetry = (sceneId: string) => {
    manualRetryGeneration(roomId, sceneId);
  };

  const handleSubmit = async (manualImageUrl?: string) => {
    if ((!newText && !manualImageUrl) || activeSlot === null) return;
    setLoading(true);
    setError('');
    
    try {
      const truncatedText = newText.length > 200 ? newText.substring(0, 197) + "..." : newText;
      const moderated = truncatedText ? moderateText(truncatedText) : "직접 올린 사진이에요.";
      await addScene(roomId, auth.currentUser!.uid, moderated, activeSlot, manualImageUrl);
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
      // 1. Compress
      const compressedBlob = await compressImage(file, 0.7, 1024);
      
      // 2. Hash for filename
      const contentHash = await generateImageHash(compressedBlob);
      const storagePath = `manual/${auth.currentUser!.uid}/${contentHash}.jpg`;
      
      // 3. Upload
      const imageUrl = await uploadImage(compressedBlob, storagePath);
      
      // 4. Submit scene with pre-uploaded URL
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
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-12 h-12 glass flex items-center justify-center text-slate-400 rounded-2xl hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 text-slate-900">
          <h2 className="text-2xl font-black tracking-tight">{room.name}</h2>
          <div className="flex items-center gap-2 font-bold text-xs">
             <span className={isActive ? "text-brand-key" : "text-slate-300"}>
               {isActive ? "✨ OPEN" : "🌙 CLOSED"}
             </span>
             <span className="text-slate-300 uppercase tracking-widest">{room.dailyTime}</span>
          </div>
        </div>
        <button onClick={() => setShowMenu(true)} className="w-12 h-12 glass flex items-center justify-center text-slate-400 rounded-2xl transition-all">
           <MoreVertical className="w-6 h-6" />
        </button>
      </div>

      {scenes.length > 0 && (
        <motion.button 
          whileHover={{ scale: 1.02, y: -4 }}
          onClick={() => setShowStory(true)}
          className="w-full glass py-8 rounded-[2.5rem] flex items-center justify-center gap-4 border-2 border-white/20 shadow-2xl relative group overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-key/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="w-16 h-16 bg-brand-key rounded-3xl flex items-center justify-center text-white shadow-xl shadow-brand-key/20 group-hover:scale-110 transition-transform">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="text-left">
            <p className="text-2xl font-black tracking-tight text-slate-800">오늘의 꼬리물기 동화</p>
            <p className="text-xs font-black text-brand-key uppercase tracking-widest">{scenes.length} / 5 SCENES</p>
          </div>
        </motion.button>
      )}

      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 5 }).map((_, i) => {
          const scene = scenes.find(s => s.index === i);
          const isNext = !scene && (i === 0 || scenes.find(s => s.index === i - 1));
          
          return (
            <motion.div
              key={i}
              initial={i < 2 ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i < 0 ? 0 : i * 0.05 }}
              className="relative aspect-square"
            >
              <div
                onClick={() => {
                  if (scene) {
                    setStoryStartIndex(i);
                    setShowStory(true);
                  } else if (isActive && isNext) {
                    setActiveSlot(i);
                  }
                }}
                className={`w-full h-full glass rounded-[2.5rem] overflow-hidden relative group transition-all cursor-pointer ${
                  isActive && isNext ? "border-brand-key/40 border-2 shadow-lg shadow-brand-key/10" : ""
                } ${!isActive && !scene ? "opacity-30 grayscale cursor-not-allowed" : ""}`}
              >
                {scene ? (
                  <>
                      <img 
                        src={scene.imageUrl} 
                        className={`w-full h-full object-cover transition-opacity duration-700 ${scene.isGenerating && scene.imageType !== 'placeholder' ? 'opacity-30 blur-sm' : 'opacity-100'}`} 
                        alt="story" 
                        referrerPolicy="no-referrer"
                        loading={i < 2 ? "eager" : "lazy"}
                        {...(i === 0 ? { fetchPriority: "high" } as any : {})}
                      />
                      {scene.isGenerating && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/5 backdrop-blur-[2px]">
                          <div className="relative">
                            <div className="w-8 h-8 border-2 border-brand-key/10 rounded-full" />
                            <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-brand-key rounded-full animate-spin" />
                          </div>
                          <span className="text-[9px] font-black text-brand-key tracking-wider animate-pulse font-sans bg-white/80 px-2 py-0.5 rounded-full shadow-sm">
                            {scene.imageType === 'placeholder' ? '인공지능 화가 호출 중...' : '마법 같은 그림 그리는 중...'}
                          </span>
                        </div>
                      )}
                      {scene.needsRetry && !scene.isGenerating && (
                        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${scene.imageType !== 'placeholder' ? 'bg-black/60 backdrop-blur-sm' : ''}`}>
                          <p className={`text-[8px] font-black text-center px-2 mb-1 ${scene.imageType !== 'placeholder' ? 'text-white' : 'text-brand-key bg-white/80 px-2 py-1 rounded-lg'}`}>
                            {scene.imageType === 'placeholder' ? '상상력이 휴식 중이에요' : '생성 실패'}
                          </p>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(scene.id);
                            }}
                            className="px-3 py-1.5 glass-light rounded-xl font-bold text-slate-800 text-[10px] flex items-center gap-1.5 active:scale-95 transition-all shadow-xl"
                          >
                            <RefreshCcw className="w-3 h-3" />
                            그림 다시 받기
                          </button>
                        </div>
                      )}
                    {!scene.isGenerating && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(scene.imageUrl, '_blank');
                        }}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full glass-dark flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/40 to-transparent">
                       <p className="text-[10px] font-bold text-white line-clamp-2 leading-snug">{scene.text}</p>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isActive && isNext ? "bg-brand-key/20 text-brand-key animate-pulse" : "bg-white/5 text-white/10"}`}>
                       <Plus className="w-6 h-6" />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isActive && isNext ? "text-brand-key" : "text-white/10"}`}>
                       {i === 0 ? "START" : "NEXT"}
                    </span>
                  </div>
                )}
                <div className="absolute top-3 left-3 w-6 h-6 rounded-full glass-dark flex items-center justify-center text-[10px] font-black text-slate-500">
                  {i + 1}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {activeSlot !== null && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="glass w-full max-w-md rounded-[3rem] p-8 space-y-8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-key/10 rounded-full blur-3xl -mr-16 -mt-16" />
              
              <div className="flex items-center justify-between relative">
                <div className="space-y-1">
                   <h3 className="text-2xl font-black text-slate-900">상상력 피워내기</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scene {activeSlot + 1}</p>
                </div>
                <button onClick={() => setActiveSlot(null)} className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-400">
                   <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6 relative text-left">
                 <div className="relative">
                    <textarea 
                      value={newText} 
                      onChange={e => setNewText(e.target.value)}
                      placeholder="어떤 일이 일어날까요? 짧고 재미있게 적어주세요!"
                      className="w-full h-44 glass-dark p-6 rounded-[2.5rem] border-transparent focus:bg-white/10 focus:ring-4 focus:ring-brand-key/20 outline-none transition-all font-bold text-xl placeholder:text-slate-400/50 resize-none whitespace-pre-wrap text-slate-900"
                    />
                    <div className="absolute bottom-6 right-6 flex gap-2">
                       {newText && (
                         <button onClick={() => setNewText('')} className="w-14 h-14 text-white/40 rounded-2xl flex items-center justify-center">
                            <X className="w-6 h-6" />
                         </button>
                       )}
                       <button 
                        onClick={handleVoiceInput}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all relative ${
                          isRecording ? "bg-red-500 text-white animate-pulse" : "glass text-brand-key"
                        }`}
                       >
                        {isRecording ? (
                          <span className="text-xl font-black">{countdown}</span>
                        ) : (
                          <Mic className="w-7 h-7" />
                        )}
                       </button>
                       <label className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all cursor-pointer ${
                         isUploading ? "bg-slate-100 animate-pulse" : "glass text-brand-key"
                       }`}>
                        <Upload className="w-7 h-7" />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleFileUpload}
                          disabled={isUploading || loading}
                        />
                       </label>
                    </div>
                 </div>
                 
                 {error && <p className="text-red-400 text-sm font-bold text-center">{error}</p>}

                 {loading ? (
                   <div className="flex flex-col items-center justify-center py-8 space-y-4">
                     <div className="w-16 h-16 border-4 border-brand-key/20 border-t-brand-key rounded-full animate-spin" />
                     <div className="text-center">
                        <p className="font-black text-slate-900 text-xl">그림으로 그리는 중!</p>
                        <p className="text-slate-400 font-bold">잠시만 기다려주세요...</p>
                     </div>
                   </div>
                 ) : (
                   <button 
                    onClick={() => handleSubmit()}
                    disabled={loading || !newText}
                    className="w-full py-6 bg-brand-key text-white rounded-[2rem] font-black text-xl shadow-xl shadow-brand-key/20 disabled:opacity-20 transition-all active:scale-95"
                   >
                     이야기 저장
                   </button>
                 )}
              </div>
            </motion.div>
          </div>
        )}

        {showMenu && room && (
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

        {showSettings && room && (
          <RoomSettings 
            room={room} 
            onClose={() => setShowSettings(false)} 
          />
        )}

        {showStory && (
          <StoryBook scenes={scenes} startIndex={storyStartIndex} onClose={() => setShowStory(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
