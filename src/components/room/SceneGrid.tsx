import React from 'react';
import { motion } from 'motion/react';
import { Scene } from '../../types';
import { Plus, RefreshCcw, Download } from 'lucide-react';

interface SceneGridProps {
  scenes: Scene[];
  isActive: boolean;
  onSlotClick: (index: number) => void;
  onSceneClick: (index: number) => void;
  onRetry: (sceneId: string) => void;
}

export function SceneGrid({ scenes, isActive, onSlotClick, onSceneClick, onRetry }: SceneGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 5 }).map((_, i) => {
        const scene = scenes.find(s => s.index === i);
        const isNext = !scene && (i === 0 || !!scenes.find(s => s.index === i - 1));
        
        return (
          <motion.div
            key={i}
            initial={i < 2 ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i < 0 ? 0 : i * 0.05 }}
            className="relative aspect-square"
          >
            <SceneCard 
              index={i}
              scene={scene}
              isActive={isActive}
              isNext={isNext}
              onClick={() => {
                if (scene) onSceneClick(i);
                else if (isActive && isNext) onSlotClick(i);
              }}
              onRetry={() => scene && onRetry(scene.id)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

interface SceneCardProps {
  index: number;
  scene?: Scene;
  isActive: boolean;
  isNext: boolean;
  onClick: () => void;
  onRetry: () => void;
}

function SceneCard({ index, scene, isActive, isNext, onClick, onRetry }: SceneCardProps) {
  return (
    <div
      onClick={onClick}
      className={`w-full h-full glass rounded-[2.5rem] overflow-hidden relative group transition-all cursor-pointer ${
        isActive && isNext ? "border-brand-key/40 border-2 shadow-lg shadow-brand-key/10" : ""
      } ${!isActive && !scene ? "opacity-30 grayscale cursor-not-allowed" : ""}`}
    >
      {scene ? (
        <>
          <img 
            src={scene.imageUrl} 
            className={`w-full h-full object-cover transition-opacity duration-700 ${scene.isGenerating && scene.imageType !== 'placeholder' ? 'opacity-30 blur-sm' : 'opacity-100'}`} 
            alt="story" 
            referrerPolicy="no-referrer"
            loading={index < 2 ? "eager" : "lazy"}
          />
          {scene.isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/5">
              <div className="relative">
                <div className="w-8 h-8 border-2 border-brand-key/10 rounded-full" />
                <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-brand-key rounded-full animate-spin" />
              </div>
              <span className="text-[9px] font-black text-brand-key tracking-wider animate-pulse font-sans bg-white/80 px-2 py-0.5 rounded-full shadow-sm text-center">
                {scene.imageType === 'placeholder' ? '화가 호출 중...' : '그림 그리는 중...'}
              </span>
            </div>
          )}
          {(scene.needsRetry || scene.imageType === 'placeholder') && !scene.isGenerating && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${scene.imageType !== 'placeholder' ? 'bg-black/60 backdrop-blur-sm' : ''}`}>
              <p className={`text-[8px] font-black text-center px-2 mb-1 ${scene.imageType !== 'placeholder' ? 'text-white' : 'text-brand-key bg-white/80 px-2 py-1 rounded-lg'}`}>
                {scene.imageType === 'placeholder' ? '상상력이 휴식 중' : '생성 실패'}
              </p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                className="px-3 py-1.5 glass-light rounded-xl font-bold text-slate-800 text-[10px] flex items-center gap-1.5 active:scale-95 transition-all shadow-xl"
              >
                <RefreshCcw className="w-3 h-3" />
                다시 받기
              </button>
            </div>
          )}
          {!scene.isGenerating && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                window.open(scene.imageUrl, '_blank');
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full glass-dark flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/40 to-transparent">
             <p className="text-[10px] font-bold text-white line-clamp-2 leading-snug">{scene.text}</p>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isActive && isNext ? "bg-brand-key/20 text-brand-key animate-pulse" : "bg-white/5 text-white/10"}`}>
             <Plus className="w-6 h-6" />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest ${isActive && isNext ? "text-brand-key" : "text-white/10"}`}>
             {index === 0 ? "START" : "NEXT"}
          </span>
        </div>
      )}
      <div className="absolute top-3 left-3 w-6 h-6 rounded-full glass-dark flex items-center justify-center text-[10px] font-black text-slate-500">
        {index + 1}
      </div>
    </div>
  );
}
