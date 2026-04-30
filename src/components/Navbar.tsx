import { BookOpen, LogOut, User } from 'lucide-react';
import { auth } from '../lib/firebase';

export function Navbar({ user, onLogoClick }: { user: any, onLogoClick: () => void }) {
  return (
    <nav className="sticky top-0 z-50 px-4 py-2 nav-bg">
      <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between rounded-[2rem] mt-2">
        

        {user && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl glass-dark flex items-center justify-center overflow-hidden border border-white/10 p-0.5">
               {user.photoURL ? (
                 <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
               ) : (
                 <User className="w-5 h-5 text-white/40" />
               )}
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="w-10 h-10 glass rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
