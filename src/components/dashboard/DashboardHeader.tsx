import React from 'react';
import { HelpCircle } from 'lucide-react';

interface DashboardHeaderProps {
  roomCount: number;
  onHelpClick: () => void;
}

export function DashboardHeader({ roomCount, onHelpClick }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h2 className="text-3xl font-black tracking-tight text-slate-900">이야기 책장</h2>
        <p className="text-sm font-bold text-slate-500">함께 만드는 마법같은 세계</p>
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={onHelpClick}
          className="w-12 h-12 glass shadow-xl rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand-key transition-all active:scale-95"
          aria-label="서비스 도움말"
        >
          <HelpCircle className="w-6 h-6" />
        </button>
        <div className="w-12 h-12 glass shadow-xl rounded-2xl flex items-center justify-center">
          <span className="font-black text-brand-key">{roomCount}</span>
        </div>
      </div>
    </div>
  );
}
