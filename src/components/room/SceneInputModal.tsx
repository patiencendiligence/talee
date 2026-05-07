import React, { ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { X, Mic, Upload } from 'lucide-react';

interface SceneInputModalProps {
  slotIndex: number;
  text: string;
  onTextChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onVoiceInput: () => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  isRecording: boolean;
  countdown: number;
  isUploading: boolean;
  loading: boolean;
  error?: string;
}

export function SceneInputModal({
  slotIndex, text, onTextChange, onClose, onSubmit, onVoiceInput, onFileUpload,
  isRecording, countdown, isUploading, loading, error
}: SceneInputModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        className="glass w-full max-w-md rounded-[3rem] p-8 space-y-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-key/10 rounded-full blur-3xl -mr-16 -mt-16" />
        
        <div className="flex items-center justify-between relative">
          <div className="space-y-1">
             <h3 className="text-2xl font-black text-slate-900">상상력 피워내기</h3>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scene {slotIndex + 1}</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-400">
             <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6 relative text-left">
           <div className="relative">
              <textarea 
                value={text} 
                onChange={e => onTextChange(e.target.value)}
                placeholder="어떤 일이 일어날까요? 짧고 재미있게 적어주세요!"
                className="w-full h-44 glass-dark p-6 rounded-[2.5rem] border-transparent focus:bg-white/10 focus:ring-4 focus:ring-brand-key/20 outline-none transition-all font-bold text-xl placeholder:text-slate-400/50 resize-none whitespace-pre-wrap text-slate-900"
              />
              <div className="absolute bottom-6 right-6 flex gap-2">
                 {text && (
                   <button onClick={() => onTextChange('')} className="w-14 h-14 text-white/40 rounded-2xl flex items-center justify-center">
                      <X className="w-6 h-6" />
                   </button>
                 )}
                 <button 
                  onClick={onVoiceInput}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all relative ${
                    isRecording ? "bg-red-500 text-white animate-pulse" : "glass text-brand-key"
                  }`}
                 >
                  {isRecording ? (
                    <span className="text-xl font-black">{countdown}</span>
                  ) : (
                    <Mic className="w-7 h-7" />
                  )}
                 </button>
                 <label className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all cursor-pointer ${
                   isUploading ? "bg-slate-100 animate-pulse" : "glass text-brand-key"
                 }`}>
                  <Upload className="w-7 h-7" />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={onFileUpload}
                    disabled={isUploading || loading}
                  />
                 </label>
              </div>
           </div>
           
           {error && <p className="text-red-400 text-sm font-bold text-center">{error}</p>}

           {loading ? (
             <div className="flex flex-col items-center justify-center py-8 space-y-4">
               <div className="w-16 h-16 border-4 border-brand-key/20 border-t-brand-key rounded-full animate-spin" />
               <div className="text-center">
                  <p className="font-black text-slate-900 text-xl">그림으로 그리는 중!</p>
                  <p className="text-slate-400 font-bold">잠시만 기다려주세요...</p>
               </div>
             </div>
           ) : (
             <button 
              onClick={onSubmit}
              disabled={loading || !text}
              className="w-full py-6 bg-brand-key text-white rounded-[2rem] font-black text-xl shadow-xl shadow-brand-key/20 disabled:opacity-20 transition-all active:scale-95"
             >
               이야기 저장
             </button>
           )}
        </div>
      </motion.div>
    </div>
  );
}
