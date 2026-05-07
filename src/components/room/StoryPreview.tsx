import React from 'react';
import { motion } from 'motion/react';
import { BookOpen } from 'lucide-react';

interface StoryPreviewProps {
  sceneCount: number;
  onClick: () => void;
}

export function StoryPreview({ sceneCount, onClick }: StoryPreviewProps) {
  if (sceneCount === 0) return null;

  return (
    <motion.button 
      whileHover={{ scale: 1.02, y: -4 }}
      onClick={onClick}
      className="w-full glass py-8 rounded-[2.5rem] flex items-center justify-center gap-4 border-2 border-white/20 shadow-2xl relative group overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-key/10 rounded-full blur-3xl -mr-16 -mt-16" />
      <div className="w-16 h-16 bg-brand-key rounded-3xl flex items-center justify-center text-white shadow-xl shadow-brand-key/20 group-hover:scale-110 transition-transform">
        <BookOpen className="w-8 h-8" />
      </div>
      <div className="text-left">
        <p className="text-2xl font-black tracking-tight text-slate-800">오늘의 꼬리물기 동화</p>
        <p className="text-xs font-black text-brand-key uppercase tracking-widest">{sceneCount} / 5 SCENES</p>
      </div>
    </motion.button>
  );
}
