import React from 'react';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { Room } from '../../types';

interface RoomHeaderProps {
  room: Room;
  isActive: boolean;
  remainingEnergy: number | null;
  onBack: () => void;
  onMenuClick: () => void;
}

export function RoomHeader({ room, isActive, remainingEnergy, onBack, onMenuClick }: RoomHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onBack} className="w-12 h-12 glass flex items-center justify-center text-slate-400 rounded-2xl hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-6 h-6" />
      </button>
      <div className="flex-1 text-slate-900">
        <h2 className="text-2xl font-black tracking-tight">{room.name}</h2>
        <div className="flex items-center gap-2 font-bold text-xs mt-1">
           <span className={isActive ? "text-brand-key" : "text-slate-300"}>
             {isActive ? "✨ OPEN" : "🌙 CLOSED"}
           </span>
           <span className="text-slate-300 uppercase tracking-widest">{room.dailyTime}</span>
           {remainingEnergy !== null && (
             <span className="ml-2 px-2 py-0.5 bg-yellow-400/10 text-yellow-600 rounded-full flex items-center gap-1">
               ⚡️ {remainingEnergy}
             </span>
           )}
        </div>
      </div>
      <button onClick={onMenuClick} className="w-12 h-12 glass flex items-center justify-center text-slate-400 rounded-2xl transition-all">
         <MoreVertical className="w-6 h-6" />
      </button>
    </div>
  );
}
