import { useState } from 'react';

export function useVoiceRecognition(onResult: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("말하기 검색이 지원되지 않는 브라우저입니다.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.onstart = () => {
      setIsRecording(true);
      setCountdown(5);
    };
    recognition.onend = () => {
      setIsRecording(false);
      setCountdown(0);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.start();
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          recognition.stop();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return { isRecording, countdown, startListening };
}
