import { Scene } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Download } from 'lucide-react';

export function StoryBook({ scenes, startIndex = 0, onClose }: { scenes: Scene[], startIndex?: number, onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  if (scenes.length === 0) return null;

  const currentScene = scenes[currentIndex];

  return (
    <div className="fixed inset-0 bg-[#eaece5] z-[200] flex flex-col">

        <div className="absolute glass-light px-4 py-2 rounded-2xl font-black text-slate-900 shadow-sm" style={{top: '20px', left:'20px'}}>
           {currentIndex + 1} / {scenes.length}
        </div>
        <button onClick={onClose} className="absolute w-12 h-12 glass rounded-2xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-900 transition-colors" style={{ top:'20px', right: '20px', zIndex:10}}>
          <X className="w-6 h-6" />
        </button>


      <div style={{ 'overflowY': 'scroll'}} className="flex-1 relative flex items-center justify-center px-3">
       <button 
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex-0 mr-1 h-10 glass rounded-[2rem] flex items-center justify-center text-brand-key disabled:opacity-10 shadow-lg active:scale-95 transition-all"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.1, rotate: 2 }}
            className="w-full  max-w-md flex flex-col items-center gap-2"
          >
            <div className="w-full aspect-[4/5] rounded-[3rem] shadow-[0_40px_80px_rgba(0,0,0,0.4)] bg-white/5 p-4 border border-white/10 relative group">
              <img 
                src={currentScene.imageUrl} 
                className={`w-full h-full object-cover rounded-[1.5rem] shadow-2xl transition-all duration-700 ${currentScene.isGenerating ? 'blur-md opacity-50 scale-105' : 'blur-0 opacity-100'}`} 
                alt="Scene" 
                referrerPolicy="no-referrer"
              />
              {currentScene.isGenerating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/10 rounded-[2.5rem]">
                  <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="text-sm font-black text-white animate-pulse">이미지를 그리는 중...</span>
                </div>
              )}
              {!currentScene.isGenerating && (
                <button 
                  onClick={() => window.open(currentScene.imageUrl, '_blank')}
                  className="absolute top-8 right-8 w-12 h-12 glass shadow-xl rounded-2xl flex items-center justify-center text-slate-900 opacity-0 group-hover:opacity-100 transition-all active:scale-95 px-0 py-0 border-none"
                >
                  <Download className="w-6 h-6" />
                </button>
              )}
              <div className="absolute top-8 left-8 w-10 h-10 glass-light rounded-full flex items-center justify-center font-black text-slate-900 text-xs">
                {currentIndex + 1}
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-xl sm:text-xl text-white font-black text-center leading-relaxed tracking-tight drop-shadow-xl">
                "{currentScene.text}"
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
        <button 
            onClick={() => setCurrentIndex(prev => Math.min(scenes.length - 1, prev + 1))}
            disabled={currentIndex === scenes.length - 1}
            className="flex-0 ml-1 h-10 bg-brand-key rounded-[2rem] flex items-center justify-center text-white disabled:opacity-20 shadow-xl shadow-brand-key/20 active:scale-95 transition-all"
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        
      </div>

    </div>
  );
}
