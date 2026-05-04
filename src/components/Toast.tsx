import { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

interface Toast {
  message: string;
  type: 'success' | 'error';
  id: number;
}

interface ToastContextType {
  setToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const setToast = (toast: Omit<Toast, 'id'>) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ setToast }}>
      {children}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className={`flex items-center gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border ${
                toast.type === 'success' 
                  ? 'bg-brand-key/90 border-brand-key/20 text-white' 
                  : 'bg-red-500/90 border-red-500/20 text-white'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <p className="font-bold flex-1">{toast.message}</p>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="p-1 hover:bg-black/10 rounded-lg transition-colors border border-transparent"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
