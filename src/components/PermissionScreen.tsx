import { useState } from 'react';
import { motion } from 'motion/react';
import { Mic, Bell, Sparkles } from 'lucide-react';

export function PermissionScreen({ onComplete }: { onComplete: () => void }) {
  const [micGranted, setMicGranted] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  const requestMic = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
    } catch (err) {
      alert("마이크 권한이 필요합니다.");
    }
  };

  const requestNotif = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotifGranted(permission === 'granted');
    } else {
      setNotifGranted(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-12">
      <div className="space-y-4">
        <h1 className="text-3xl font-black tracking-tight">탈리와 이야기 꼬리물기 준비하기</h1>
        <p className="text-gray-100/60 font-medium whitespace-pre-wrap">
          마법같은 이야기를 만들기 위해{"\n"}몇 가지 권한이 필요해요!
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
        <button
          onClick={requestMic}
          className={`flex items-center gap-4 p-6 rounded-[2rem] transition-all ${
            micGranted ? "bg-teal-500 text-white" : "glass hover:bg-white/20"
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${micGranted ? "bg-white/20" : "bg-teal-500/20"}`}>
            <Mic className="w-6 h-6" />
          </div>
          <div className="text-left flex-1">
            <p className="font-bold">목소리 상상력 (마이크)</p>
            <p className="text-xs opacity-60">말하는 대로 이야기가 그려져요</p>
          </div>
        </button>

        <button
          onClick={requestNotif}
          className={`flex items-center gap-4 p-6 rounded-[2rem] transition-all ${
            notifGranted ? "bg-teal-500 text-white" : "glass hover:bg-white/20"
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${notifGranted ? "bg-white/20" : "bg-teal-500/20"}`}>
            <Bell className="w-6 h-6" />
          </div>
          <div className="text-left flex-1">
            <p className="font-bold">꼬리물기시간 알림</p>
            <p className="text-xs opacity-60">이야기방이 열리는 시간을 알려드려요</p>
          </div>
        </button>
      </div>

      <button
        onClick={onComplete}
        disabled={!micGranted}
        className="w-full max-w-sm py-6 bg-white text-teal-900 rounded-[2rem] font-black text-xl shadow-2xl disabled:opacity-30 active:scale-95 transition-all"
      >
        입장하기
      </button>
    </div>
  );
}
