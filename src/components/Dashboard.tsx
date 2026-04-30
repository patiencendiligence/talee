import React, { useState, useEffect, FormEvent } from 'react';
import { UserProfile, Room } from '../types';
import { Plus, DoorOpen, Calendar, Users, Hash, X } from 'lucide-react';
import { createRoom } from '../services/roomService';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

export function Dashboard({ profile, onEnterRoom }: { profile: UserProfile | null, onEnterRoom: (id: string) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomTime, setNewRoomTime] = useState('21:00');
  const [maxMembers, setMaxMembers] = useState(4);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    const q = query(collection(db, "rooms"), where("members", "array-contains", profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRooms(snapshot.docs.map(doc => doc.data() as Room));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "rooms");
    });
    return unsubscribe;
  }, [profile]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRoomName || !newRoomTime) return;
    setLoading(true);
    try {
      const id = await createRoom(auth.currentUser!.uid, newRoomName, newRoomTime, maxMembers);
      setShowCreate(false);
      onEnterRoom(id);
    } catch (err) {
      alert("방 생성 실패: " + err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode || !profile) return;
    setLoading(true);
    try {
      const roomRef = doc(db, "rooms", joinCode);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        alert("방을 찾을 수 없습니다.");
        return;
      }
      
      const roomData = roomSnap.data() as Room;
      if (roomData.members.includes(profile.uid)) {
        onEnterRoom(joinCode);
        return;
      }

      if (roomData.members.length >= roomData.maxMembers) {
        alert("방이 가득 찼습니다.");
        return;
      }

      await updateDoc(roomRef, {
        members: arrayUnion(profile.uid)
      });
      await updateDoc(doc(db, "users", profile.uid), {
        roomIds: arrayUnion(joinCode)
      });
      
      setShowJoin(false);
      onEnterRoom(joinCode);
    } catch (err) {
      alert("입장 실패: " + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 pt-4">
      <div className="flex items-center justify-between">
         <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">이야기 책장</h2>
            <p className="text-sm font-bold text-slate-500">함께 만드는 마법같은 세계</p>
         </div>
         <div className="w-12 h-12 glass shadow-xl rounded-2xl flex items-center justify-center">
            <span className="font-black text-teal-400">{rooms.length}</span>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => setShowCreate(true)}
          className="glass aspect-[4/3] rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-white/20 transition-all border-dashed border-white/20"
        >
          <div className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-teal-500/20">
            <Plus className="w-8 h-8" />
          </div>
          <span className="font-bold text-slate-700">방 만들기</span>
        </button>
        <button 
          onClick={() => setShowJoin(true)}
          className="glass aspect-[4/3] rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-white/20 transition-all"
        >
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white border border-white/10">
            <DoorOpen className="w-7 h-7" />
          </div>
          <span className="font-bold text-slate-700">방 입장하기</span>
        </button>
      </div>

      <AnimatePresence>
        {(showCreate || showJoin) && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowCreate(false); setShowJoin(false); }}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-sm rounded-[3rem] p-8 relative space-y-6"
            >
               <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black tracking-tight">
                    {showCreate ? "이야기 방 만들기" : "이야기 방 입장하기"}
                  </h3>
                  <button onClick={() => { setShowCreate(false); setShowJoin(false); }} className="text-white/40">
                    <X className="w-6 h-6" />
                  </button>
               </div>

               <form onSubmit={showCreate ? handleCreate : handleJoin} className="space-y-6">
                  {showCreate ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">방 제목</label>
                        <input 
                          type="text" 
                          value={newRoomName} 
                          onChange={e => setNewRoomName(e.target.value)}
                          className="w-full glass-dark p-5 rounded-[1.5rem] border-transparent focus:bg-white/10 focus:ring-2 focus:ring-teal-500/50 outline-none transition-all placeholder:text-slate-400/50 font-bold text-slate-900"
                          placeholder="어떤 이야기를 만드나요?"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">모이는 시간</label>
                        <input 
                          type="time" 
                          value={newRoomTime} 
                          onChange={e => setNewRoomTime(e.target.value)}
                          className="w-full glass-dark p-5 rounded-[1.5rem] border-transparent focus:bg-white/10 focus:ring-2 focus:ring-teal-500/50 outline-none transition-all font-bold text-slate-900"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">최대 인원 (최대 4명)</label>
                        <input 
                          type="number" 
                          min={1}
                          max={4}
                          value={maxMembers} 
                          onChange={e => setMaxMembers(parseInt(e.target.value))}
                          className="w-full glass-dark p-5 rounded-[1.5rem] border-transparent focus:bg-white/10 focus:ring-2 focus:ring-teal-500/50 outline-none transition-all font-bold text-slate-900"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-black text-teal-100/50 uppercase tracking-widest ml-4">초대 코드</label>
                      <div className="relative">
                        <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-teal-400" />
                        <input 
                          type="text" 
                          value={joinCode} 
                          onChange={e => setJoinCode(e.target.value)}
                          className="w-full glass-dark p-5 pl-14 rounded-[1.5rem] border-transparent focus:bg-white/10 focus:ring-2 focus:ring-teal-500/50 outline-none transition-all placeholder:text-white/20 font-bold uppercase"
                          placeholder="코드 입력"
                        />
                      </div>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-teal-500 py-6 rounded-[2rem] font-black text-xl shadow-xl shadow-teal-500/10 active:scale-95 transition-all text-white"
                  >
                    {loading ? "기다려주세요..." : (showCreate ? "시작하기" : "입장하기")}
                  </button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">참여 중인 책장</h3>
        {rooms.length === 0 ? (
          <div className="text-center py-16 glass rounded-[3rem] border-dashed border-slate-200">
            <p className="text-slate-400 font-bold text-sm italic">
              "텅 비어있어요. 상상을 채워보세요!"
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {rooms.map(room => (
              <motion.button
                key={room.id}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => onEnterRoom(room.id)}
                className="flex items-center justify-between glass card-child text-left group overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="space-y-3 relative">
                  <h4 className="font-black text-2xl text-slate-900 group-hover:text-teal-600 transition-colors tracking-tight">{room.name}</h4>
                  <div className="flex items-center gap-3 text-xs font-black">
                    <span className="flex items-center gap-1.5 glass-dark px-3 py-1.5 rounded-xl uppercase text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" /> {room.dailyTime}
                    </span>
                    <span className="flex items-center gap-1.5 glass-dark px-3 py-1.5 rounded-xl uppercase text-slate-600">
                      <Users className="w-3.5 h-3.5 text-blue-600" /> {room.members.length}/4
                    </span>
                  </div>
                </div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white group-hover:bg-teal-500/20 transition-all border-white/5 relative">
                  <DoorOpen className="w-6 h-6" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
