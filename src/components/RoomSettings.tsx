import { useState } from 'react';
import { Room } from '../types';
import { motion } from 'motion/react';
import { X, Save, Clock, Users, Type } from 'lucide-react';
import { updateRoom } from '../services/roomService';

interface RoomSettingsProps {
  room: Room;
  onClose: () => void;
}

export function RoomSettings({ room, onClose }: RoomSettingsProps) {
  const [name, setName] = useState(room.name);
  const [maxMembers, setMaxMembers] = useState(room.maxMembers);
  const [dailyTime, setDailyTime] = useState(room.dailyTime);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError('방 이름을 입력해주세요.');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await updateRoom(room.id, {
        name: name.trim(),
        maxMembers: Number(maxMembers),
        dailyTime,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || '저장 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass w-full max-w-md rounded-[3rem] p-6 sm:p-8 space-y-8 relative max-h-[90vh] overflow-y-auto"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-key/10 rounded-full blur-3xl -mr-16 -mt-16" />
        
        <div className="flex items-center justify-between relative">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900">방 설정</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Room Settings</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6 relative">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-black text-slate-700 ml-2">
              <Type className="w-4 h-4 text-brand-key" />
              방 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-6 py-4 glass-dark rounded-2xl border-transparent focus:ring-4 focus:ring-brand-key/20 outline-none transition-all font-bold text-lg text-slate-900"
              placeholder="방 이름을 입력하세요"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-black text-slate-700 ml-2">
                <Users className="w-4 h-4 text-brand-key" />
                최대 인원
              </label>
              <select
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="w-full px-4 py-4 sm:px-6 sm:py-4 glass-dark rounded-2xl border-transparent focus:ring-4 focus:ring-brand-key/20 outline-none transition-all font-bold text-lg text-slate-900 appearance-none"
              >
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n}명</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-black text-slate-700 ml-2">
                <Clock className="w-4 h-4 text-brand-key" />
                지정 시간
              </label>
              <input
                type="time"
                value={dailyTime}
                onChange={(e) => setDailyTime(e.target.value)}
                className="w-full px-4 py-4 sm:px-6 sm:py-4 glass-dark rounded-2xl border-transparent focus:ring-4 focus:ring-brand-key/20 outline-none transition-all font-bold text-lg text-slate-900"
              />
            </div>
          </div>
          
          <p className="text-[10px] font-bold text-slate-400 px-2 leading-relaxed">
            * 지정 시간부터 1시간 동안만 이야기 꼬리물기가 가능합니다.
          </p>

          {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-5 bg-brand-key text-white rounded-2xl font-black text-xl shadow-xl shadow-brand-key/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-6 h-6" />
                설정 저장
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
