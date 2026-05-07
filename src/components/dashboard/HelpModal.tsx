import React from 'react';
import { motion } from 'motion/react';
import { HelpCircle, X, Plus, Sparkles, Clock, BookOpen } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" >
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        style={{
          position: 'absolute',
          top: 0,
          right: 0
        }}
      />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass w-full max-w-md rounded-[3rem]relative" style={{
      maxHeight: '100vh',
      overflowY: 'scroll',
      display:'block',
      padding: '20px'
    }}
      >

          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-key rounded-xl flex items-center justify-center text-white">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black tracking-tight">서비스 이용 가이드</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6 relative" style={{
            overflowY: 'scroll',
            maxHeight: '100%',
            marginTop:'10px',
            marginBottom:'20px'
          }}>
            <div className="space-y-2">
              <p className="text-lg font-bold text-slate-800 tracking-tight leading-relaxed">
                "꼬리물기" [TALLE] 는 여러 명의 친구들이 함께 협력하여 마법같은 이야기를 만들어가는 서비스입니다.
              </p>
            </div>

            <div className="grid gap-4">
              <HelpStep 
                icon={<Plus className="w-5 h-5" />}
                color="bg-blue-500/10 text-blue-600"
                title="방 만들기 & 초대"
                desc="주제를 정하고 친구들에게 초대 코드를 공유하세요."
              />
              <HelpStep 
                icon={<Sparkles className="w-5 h-5" />}
                color="bg-brand-key/10 text-brand-key"
                title="이야기 이어가기"
                desc="AI가 그린 첫 장면 뒤에 올 이야기를 한 줄씩 적어보세요."
              />
              <HelpStep 
                icon={<Clock className="w-5 h-5" />}
                color="bg-purple-500/10 text-purple-600"
                title="우리만의 모임 시간"
                desc="매일 정해진 시간에 모여 새로운 단계를 진행할 수 있습니다."
              />
              <HelpStep 
                icon={<BookOpen className="w-5 h-5" />}
                color="bg-emerald-500/10 text-emerald-600"
                title="이야기 완성"
                desc="완성된 이야기는 아름다운 일러스트와 함께 아카이브에 저장됩니다."
              />
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full bg-brand-key py-5 rounded-[2rem] font-black text-lg text-white shadow-xl shadow-brand-key/20 active:scale-95 transition-all"
          >
            알겠어요!
          </button>

      </motion.div>
    </div>
  );
}

function HelpStep({ icon, color, title, desc }: { icon: React.ReactNode, color: string, title: string, desc: string }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/40">
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="font-black text-slate-900">{title}</p>
        <p className="text-sm font-medium text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
