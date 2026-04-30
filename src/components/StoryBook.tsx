import { Scene } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export function StoryBook({ scenes, onClose }: { scenes: Scene[], onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (scenes.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-[#eaece5] z-[200] flex flex-col">
      <div className="flex items-center justify-between p-6">
        <div className="glass-light px-4 py-2 rounded-2xl font-black text-slate-900 shadow-sm">
           {currentIndex + 1} / {scenes.length}
        </div>
        <button onClick={onClose} className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-900 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.1, rotate: 2 }}
            className="w-full max-w-sm flex flex-col items-center gap-10"
          >
            <div className="w-full aspect-[4/5] rounded-[3rem] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.4)] bg-white/5 p-4 border border-white/10 relative">
              <img 
                src={scenes[currentIndex].imageUrl} 
                className={`w-full h-full object-cover rounded-[2.5rem] shadow-2xl transition-all duration-700 ${scenes[currentIndex].isGenerating ? 'blur-md opacity-50 scale-105' : 'blur-0 opacity-100'}`} 
                alt="Scene" 
                referrerPolicy="no-referrer"
              />
              {scenes[currentIndex].isGenerating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/10 rounded-[2.5rem]">
                  <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="text-sm font-black text-white animate-pulse">이미지를 그리는 중...</span>
                </div>
              )}
              <div className="absolute top-8 left-8 w-10 h-10 glass-light rounded-full flex items-center justify-center font-black text-slate-900 text-xs">
                {currentIndex + 1}
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-2xl sm:text-3xl text-white font-black text-center leading-relaxed tracking-tight drop-shadow-xl">
                "{scenes[currentIndex].text}"
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-8 pb-16 flex items-center justify-between max-w-md mx-auto w-full gap-6">
        <button 
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="flex-1 h-20 glass rounded-[2.5rem] flex items-center justify-center text-teal-600 disabled:opacity-10 shadow-lg active:scale-95 transition-all"
        >
          <ChevronLeft className="w-10 h-10" />
        </button>
        <button 
          onClick={() => setCurrentIndex(prev => Math.min(scenes.length - 1, prev + 1))}
          disabled={currentIndex === scenes.length - 1}
          className="flex-1 h-20 bg-teal-500 rounded-[2.5rem] flex items-center justify-center text-white disabled:opacity-20 shadow-xl shadow-teal-500/20 active:scale-95 transition-all"
        >
          <ChevronRight className="w-10 h-10" />
        </button>
      </div>
    </div>
  );
}
