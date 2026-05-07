import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Scene } from '../types';
import { ArrowLeft, Calendar as CalendarIcon, BookOpen } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { motion } from 'motion/react';
import { StoryBook } from './StoryBook';

export function ArchiveView({ roomId, onBack }: { roomId: string, onBack: () => void }) {
  const [days, setDays] = useState<{ date: string, coverScene: Scene }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailScenes, setDetailScenes] = useState<Scene[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    async function fetchArchive() {
      const scenesRef = collection(db, "rooms", roomId, "scenes");
      
      // Optimization: Fetch only the FIRST scene of each day to show the list
      const q = query(
        scenesRef, 
        where("members", "array-contains", auth.currentUser?.uid),
        where("index", "==", 0), // Only fetch cover scenes
        orderBy("date", "desc"),
        limit(30) // Only last 30 days
      );
      
      try {
        const snapshot = await getDocs(q);
        const coverScenes = snapshot.docs.map(d => d.data() as Scene);
        setDays(coverScenes.map(s => ({ date: s.date, coverScene: s })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/scenes`);
      } finally {
        setLoading(false);
      }
    }
    fetchArchive();
  }, [roomId, auth.currentUser?.uid]);

  const handleSelectDay = async (date: string) => {
    setSelectedDate(date);
    setDetailLoading(true);
    
    // Fetch full scenes for the selected date only
    const scenesRef = collection(db, "rooms", roomId, "scenes");
    const q = query(
      scenesRef,
      where("date", "==", date),
      orderBy("index", "asc")
    );
    
    try {
      const snapshot = await getDocs(q);
      setDetailScenes(snapshot.docs.map(d => d.data() as Scene));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/scenes/${date}`);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-32">
       <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-12 h-12 glass flex items-center justify-center text-slate-400 rounded-2xl hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">이야기 보관함</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">PAST STORIES</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
           <div className="w-12 h-12 border-4 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : days.length === 0 ? (
        <div className="glass rounded-[3rem] p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto text-white/20">
             <CalendarIcon className="w-8 h-8" />
          </div>
          <p className="font-bold text-slate-400">아직 저장된 이야기가 없어요.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {days.map((group, i) => (
            <motion.button
              key={group.date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleSelectDay(group.date)}
              className="glass p-6 rounded-[2.5rem] flex items-center gap-6 text-left group hover:bg-white/20 transition-all"
            >
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                <img src={group.coverScene.imageUrl} className="w-full h-full object-cover" alt="cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-black text-slate-900">{format(new Date(group.date), 'PPPP')}</p>
                <div className="flex items-center gap-2 mt-1">
                   <BookOpen className="w-4 h-4 text-brand-key" />
                   <p className="text-xs font-black text-brand-key uppercase tracking-widest">VIEW STORY</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {selectedDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          {detailLoading ? (
            <div className="w-12 h-12 border-4 border-white/10 border-t-brand-key rounded-full animate-spin" />
          ) : (
            <StoryBook scenes={detailScenes} onClose={() => setSelectedDate(null)} />
          )}
        </div>
      )}
    </div>
  );
}
