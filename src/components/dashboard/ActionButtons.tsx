import React from 'react';
import { Plus, DoorOpen } from 'lucide-react';

interface ActionButtonsProps {
  onCreateClick: () => void;
  onJoinClick: () => void;
}

export function ActionButtons({ onCreateClick, onJoinClick }: ActionButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <button 
        onClick={onCreateClick}
        className="glass aspect-[4/3] rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-white/20 transition-all border-dashed border-white/20"
      >
        <div className="w-14 h-14 bg-brand-key rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-key/20">
          <Plus className="w-8 h-8" />
        </div>
        <span className="font-bold text-slate-700">방 만들기</span>
      </button>
      <button 
        onClick={onJoinClick}
        className="glass aspect-[4/3] rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:bg-white/20 transition-all"
      >
        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white border border-white/10">
          <DoorOpen className="w-7 h-7" />
        </div>
        <span className="font-bold text-slate-700">방 입장하기</span>
      </button>
    </div>
  );
}
