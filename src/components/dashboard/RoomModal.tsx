import React, { FormEvent } from 'react';
import { motion } from 'motion/react';
import { X, Hash } from 'lucide-react';

interface RoomModalProps {
  type: 'create' | 'join';
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
  // Create state
  name?: string;
  setName?: (v: string) => void;
  time?: string;
  setTime?: (v: string) => void;
  maxMembers?: number;
  setMaxMembers?: (v: number) => void;
  // Join state
  joinCode?: string;
  setJoinCode?: (v: string) => void;
}

export function RoomModal({
  type, onClose, onSubmit, loading,
  name, setName, time, setTime, maxMembers, setMaxMembers,
  joinCode, setJoinCode
}: RoomModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="glass w-full max-w-sm rounded-[3rem] p-6 sm:p-8 relative space-y-6 max-h-[90vh] overflow-y-auto"
      >
         <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black tracking-tight">
              {type === 'create' ? "이야기 방 만들기" : "이야기 방 입장하기"}
            </h3>
            <button onClick={onClose} className="text-white/40">
              <X className="w-6 h-6" />
            </button>
         </div>

         <form onSubmit={onSubmit} className="space-y-6">
            {type === 'create' ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">방 제목</label>
                  <input 
                    type="text" 
                    required
                    value={name} 
                    onChange={e => setName?.(e.target.value)}
                    className="w-full glass-dark px-4 py-4 sm:p-5 rounded-[1.5rem] border-transparent focus:bg-white/10 focus:ring-2 focus:ring-brand-key/50 outline-none transition-all placeholder:text-slate-400/50 font-bold text-slate-900"
                    placeholder="어떤 이야기를 만드나요?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">모이는 시간</label>
                  <input 
                    type="time" 
                    required
                    value={time} 
                    onChange={e => setTime?.(e.target.value)}
                    className="w-full glass-dark px-4 py-4 sm:p-5 rounded-[1.5rem] border-transparent focus:bg-white/10 focus:ring-2 focus:ring-brand-key/50 outline-none transition-all font-bold text-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">최대 인원 (최대 4명)</label>
                  <input 
                    type="number" 
                    min={1}
                    max={4}
                    required
                    value={maxMembers} 
                    onChange={e => setMaxMembers?.(parseInt(e.target.value))}
                    className="w-full glass-dark px-4 py-4 sm:p-5 rounded-[1.5rem] border-transparent focus:bg-white/10 focus:ring-2 focus:ring-brand-key/50 outline-none transition-all font-bold text-slate-900"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-black text-brand-key uppercase tracking-widest ml-4">초대 코드</label>
                <div className="relative">
                  <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-key" />
                  <input 
                    type="text" 
                    required
                    value={joinCode} 
                    onChange={e => setJoinCode?.(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full glass-dark px-4 py-4 sm:p-5 sm:pl-14 pl-12 rounded-[1.5rem] border-transparent focus:bg-white/10 focus:ring-2 focus:ring-brand-key/50 outline-none transition-all placeholder:text-white/20 font-bold uppercase"
                    placeholder="0000000000"
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-brand-key py-6 rounded-[2rem] font-black text-xl shadow-xl shadow-brand-key/10 active:scale-95 transition-all text-white"
            >
              {loading ? "기다려주세요..." : (type === 'create' ? "시작하기" : "입장하기")}
            </button>
         </form>
      </motion.div>
    </div>
  );
}
