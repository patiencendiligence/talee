import { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, BookOpen, Share2, Settings, Download, X } from 'lucide-react';
import { Room } from '../types';

export function RoomMenu({ 
  room, 
  onClose, 
  onNavigate,
  onDelete
}: { 
  room: Room, 
  onClose: () => void,
  onNavigate: (view: 'settings' | 'archive') => void,
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const copyInvite = () => {
    const msg = `나랑 꼬리물기 이야기 만들자! 초대코드 ${room.id} 야. ${window.location.origin}`;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOwner = room.ownerId === (window as any).currentUserUid; 

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
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
        className="glass w-full max-w-sm rounded-[3rem] p-8 relative space-y-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black tracking-tight text-slate-900">{room.name}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <button 
            onClick={copyInvite}
            className="w-full glass-light p-5 rounded-[2rem] flex items-center justify-between hover:bg-white/30 transition-all text-left"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Room Code</p>
              <p className="font-mono font-bold text-brand-key">{room.id.slice(0, 8)}...</p>
            </div>
            <div className="bg-brand-key text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg">
              {copied ? "COPIED!" : "INVITE"}
            </div>
          </button>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => onNavigate('archive')}
              className="glass-dark p-6 rounded-[2rem] flex flex-col items-center gap-3 hover:bg-slate-900/10 transition-all border border-slate-900/5"
            >
              <Calendar className="w-8 h-8 text-purple-500" />
              <span className="font-bold text-sm text-slate-700">보관함</span>
            </button>
            <button 
              className="glass-dark p-6 rounded-[2rem] flex flex-col items-center gap-3 hover:bg-black/40 transition-all opacity-50"
              title="Coming Soon"
            >
              <Download className="w-8 h-8 text-blue-400" />
              <span className="font-bold text-sm text-slate-700">저장하기</span>
            </button>
          </div>

          <button 
            onClick={() => onNavigate('settings')}
            className="w-full glass-dark p-5 rounded-[2rem] flex items-center gap-4 hover:bg-slate-900/10 transition-all border border-slate-900/5"
          >
            <Settings className="w-6 h-6 text-slate-400" />
            <span className="font-bold text-slate-700">방 설정 관리</span>
          </button>

          {confirmDelete ? (
            <div className="flex gap-2">
              <button 
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-4 glass rounded-2xl font-bold text-slate-600"
              >
                취소
              </button>
              <button 
                onClick={onDelete}
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-500/20"
              >
                삭제하기
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setConfirmDelete(true)}
              className="w-full py-4 text-red-500/60 hover:text-red-500 font-bold text-sm transition-colors"
            >
              이 방 삭제하기
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
