import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Landing } from './components/Landing';
import { Dashboard } from './components/Dashboard';
import { RoomView } from './components/RoomView';
import { ArchiveView } from './components/ArchiveView';
import { PermissionScreen } from './components/PermissionScreen';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { UserProfile } from './types';
import { doc, getDoc } from 'firebase/firestore';
import { loginWithGoogle } from './services/authService';
import { ToastProvider } from './components/Toast';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'room' | 'archive'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [hasPermissions, setHasPermissions] = useState(() => {
    return localStorage.getItem('talee_permissions') === 'granted';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setLoading(false); // Set loading to false as soon as user is found
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, "users/" + u.uid);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const handlePermissionsComplete = () => {
    localStorage.setItem('talee_permissions', 'granted');
    setHasPermissions(true);
  };

  const handleLogoClick = () => {
    setActiveRoomId(null);
    setCurrentView('dashboard');
  };

  const handleLogin = async () => {
    try {
      const p = await loginWithGoogle();
      if (p) setProfile(p);
    } catch (error) {
      console.error("Login failed:", error);
      throw error; // Let Landing catch and show error
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen font-sans bg-[#eaece5] text-brand-key">
      <div className="animate-pulse font-black text-2xl tracking-tighter text-brand-key">TALEE</div>
    </div>
  );

  if (user && !hasPermissions) {
    return <PermissionScreen onComplete={handlePermissionsComplete} />;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen text-slate-50 font-sans selection:bg-brand-key/30">
        <Navbar user={user} onLogoClick={handleLogoClick} />
        
        <main className="max-w-2xl mx-auto px-4 py-8">
          {(!user || (user && !profile && !loading)) ? (
            <Landing onLogin={handleLogin} />
          ) : activeRoomId && currentView === 'room' ? (
            <RoomView 
              roomId={activeRoomId} 
              onBack={() => setCurrentView('dashboard')} 
              onOpenArchive={() => setCurrentView('archive')}
            />
          ) : activeRoomId && currentView === 'archive' ? (
            <ArchiveView roomId={activeRoomId} onBack={() => setCurrentView('room')} />
          ) : (
            <Dashboard profile={profile} onEnterRoom={(id) => {
              setActiveRoomId(id);
              setCurrentView('room');
            }} />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
