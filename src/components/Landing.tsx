import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Clock, Users } from 'lucide-react';
import taleeImg from '../assets/talee.jpg';

export function Landing({ onLogin }: { onLogin: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await onLogin();
    } catch (err: any) {
      console.error("Login Error:", err);
      const isIframe = window.self !== window.top;
      
      if (err.code === 'auth/popup-blocked') {
        setError("팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError("로그인 창이 닫혔습니다. 다시 시도해주세요.");
      } else if (err.code === 'auth/cancelled-popup-request') {
         // Silently ignore or handle if needed
      } else if (isIframe || /KAKAOTALK|LINE|FBAN|FBAV/i.test(navigator.userAgent)) {
        setError("보안 정책으로 인해 로그인이 차단되었습니다. 오른쪽 상단의 '내보내기' 아이콘 또는 '다른 브라우저로 열기'를 선택하여 크롬(Chrome)이나 사파리(Safari)로 접속해주세요.");
      } else {
        setError("로그인에 실패했습니다. 크롬이나 사파리 브라우저에서 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <h1 className="text-5xl font-black tracking-tight text-slate-900 sm:text-6xl drop-shadow-sm">
          talee
        </h1>
        <p className="text-xl text-slate-500 max-w-xs mx-auto font-medium">
          매일 1시간, 5개의 이야기로 채워지는<br /> 우리만의 꼬리물기 이야기책
        </p>
      </motion.div>
      <motion.div 
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className="relative"
      >
        <div className="w-64 h-64 relative">
          <div className="absolute blur-3xl animate-pulse" />
          <img 
            src={taleeImg} 
            className="w-full h-full object-contain relative z-10" 
            alt="Talee Character"
            referrerPolicy="no-referrer"
            loading="eager"
            {...({ fetchPriority: "high" } as any)}
          />
          <div className="absolute -top-4 -right-4 w-14 h-14 glass-light rounded-full flex items-center justify-center shadow-2xl z-20">
            <Sparkles className="w-7 h-7 text-brand-key" />
          </div>
        </div>
      </motion.div>

     

      <div className="flex flex-col gap-4 w-full max-w-sm pt-8">
        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-white/30 text-slate-900 py-6 rounded-[2rem] font-black text-xl hover:bg-slate-50 transition-all shadow-xl active:scale-95 border border-slate-200 disabled:opacity-50"
        >
          {loading ? "기다려주세요..." : "시작하기"}
        </button>
        {error && (
          <p className="text-red-500 text-sm font-bold animate-bounce">{error}</p>
        )}
      </div>
    </div>
  );
}
