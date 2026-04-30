import { useState, useEffect } from 'react';
import { Room, Scene } from '../types';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { ArrowLeft, Plus, Mic, Image as ImageIcon, CheckCircle2, Clock, BookOpen, MoreVertical, X, Share2, Trash2, Download } from 'lucide-react';
import { StoryBook } from './StoryBook';
import { RoomMenu } from './RoomMenu';
import { addScene, deleteRoom } from '../services/roomService';
import { moderateText } from '../lib/utils';
import { format, addHours, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export function RoomView({ roomId, onBack, onOpenArchive }: { roomId: string, onBack: () => void, onOpenArchive: () => void }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [newText, setNewText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showStory, setShowStory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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
      orderBy("index", "asc")
    );
    const unsubScenes = onSnapshot(q, (sn) => {
      setScenes(sn.docs.map(d => d.data() as Scene));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/scenes`);
    });

    return () => {
      unsubRoom();
      unsubScenes();
    };
  }, [roomId, today]);

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
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNewText(transcript);
    };

    recognition.start();
    setTimeout(() => recognition.stop(), 8000);
  };

  const handleSubmit = async () => {
    if (!newText || activeSlot === null) return;
    setLoading(true);
    setError('');
    
    try {
      const moderated = moderateText(newText);
      await addScene(roomId, auth.currentUser!.uid, moderated, activeSlot);
      setActiveSlot(null);
      setNewText('');
    } catch (err: any) {
      setError(err.message || '저장 실패');
    } finally {
      setLoading(false);
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
             <span className={isActive ? "text-teal-600" : "text-slate-300"}>
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
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="w-16 h-16 bg-teal-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-teal-500/20 group-hover:scale-110 transition-transform">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="text-left">
            <p className="text-2xl font-black tracking-tight text-slate-800">오늘의 꼬리물기 동화</p>
            <p className="text-xs font-black text-teal-600 uppercase tracking-widest">{scenes.length} / 7 SCENES</p>
          </div>
        </motion.button>
      )}

      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 7 }).map((_, i) => {
          const scene = scenes.find(s => s.index === i);
          const isNext = !scene && (i === 0 || scenes.find(s => s.index === i - 1));
          
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="relative aspect-square"
            >
               <button
                onClick={() => isActive && !scene && setActiveSlot(i)}
                className={`w-full h-full glass rounded-[2.5rem] overflow-hidden relative group transition-all ${
                  isActive && isNext ? "border-teal-500/40 border-2 shadow-lg shadow-teal-500/10" : ""
                } ${!isActive && !scene ? "opacity-30 grayscale" : ""}`}
              >
                {scene ? (
                  <>
                    <img 
                      src={scene.imageUrl} 
                      className={`w-full h-full object-cover transition-opacity duration-700 ${scene.isGenerating ? 'opacity-30 blur-sm' : 'opacity-100'}`} 
                      alt="story" 
                      referrerPolicy="no-referrer" 
                    />
                    {scene.isGenerating && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
                        <span className="text-[8px] font-black text-teal-600 animate-pulse font-sans">그리는 중...</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/40 to-transparent">
                       <p className="text-[10px] font-bold text-white line-clamp-2 leading-snug">{scene.text}</p>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isActive && isNext ? "bg-teal-500/20 text-teal-400 animate-pulse" : "bg-white/5 text-white/10"}`}>
                       <Plus className="w-6 h-6" />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isActive && isNext ? "text-teal-400" : "text-white/10"}`}>
                       {i === 0 ? "START" : "NEXT"}
                    </span>
                  </div>
                )}
                <div className="absolute top-3 left-3 w-6 h-6 rounded-full glass-dark flex items-center justify-center text-[10px] font-black text-slate-500">
                  {i + 1}
                </div>
              </button>
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
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
              
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
                      className="w-full h-44 glass-dark p-6 rounded-[2.5rem] border-transparent focus:bg-white/10 focus:ring-4 focus:ring-teal-500/20 outline-none transition-all font-bold text-xl placeholder:text-slate-400/50 resize-none whitespace-pre-wrap text-slate-900"
                    />
                    <div className="absolute bottom-6 right-6 flex gap-2">
                       {newText && (
                         <button onClick={() => setNewText('')} className="w-14 h-14 text-white/40 rounded-2xl flex items-center justify-center">
                            <X className="w-6 h-6" />
                         </button>
                       )}
                       <button 
                        onClick={handleVoiceInput}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all ${
                          isRecording ? "bg-red-500 text-white animate-pulse" : "glass text-teal-400"
                        }`}
                       >
                        <Mic className="w-7 h-7" />
                       </button>
                    </div>
                 </div>
                 
                 {error && <p className="text-red-400 text-sm font-bold text-center">{error}</p>}

                 {loading ? (
                   <div className="flex flex-col items-center justify-center py-8 space-y-4">
                     <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                     <div className="text-center">
                        <p className="font-black text-slate-900 text-xl">그림으로 그리는 중!</p>
                        <p className="text-slate-400 font-bold">잠시만 기다려주세요...</p>
                     </div>
                   </div>
                 ) : (
                   <button 
                    onClick={handleSubmit}
                    disabled={loading || !newText}
                    className="w-full py-6 bg-teal-500 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-teal-500/20 disabled:opacity-20 transition-all active:scale-95"
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
              if (view === 'settings') alert('설정 화면 개발 중');
              if (view === 'archive') onOpenArchive();
            }}
          />
        )}

        {showStory && (
          <StoryBook scenes={scenes} onClose={() => setShowStory(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
