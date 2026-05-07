import React, { useState, FormEvent } from 'react';
import { UserProfile, Room } from '../types';
import { createRoom } from '../services/roomService';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { AnimatePresence } from 'motion/react';
import { useRooms } from '../hooks/useRooms';

// Sub-components
import { DashboardHeader } from './dashboard/DashboardHeader';
import { ActionButtons } from './dashboard/ActionButtons';
import { HelpModal } from './dashboard/HelpModal';
import { RoomModal } from './dashboard/RoomModal';
import { RoomList } from './dashboard/RoomList';

export function Dashboard({ profile, onEnterRoom }: { profile: UserProfile | null, onEnterRoom: (id: string) => void }) {
  const { rooms } = useRooms(profile?.uid);
  
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomTime, setNewRoomTime] = useState('21:00');
  const [maxMembers, setMaxMembers] = useState(4);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRoomName || !newRoomTime) return;
    setLoading(true);
    try {
      const id = await createRoom(auth.currentUser!.uid, newRoomName, newRoomTime, maxMembers);
      setShowCreate(false);
      onEnterRoom(id);
    } catch (err) {
      alert("방 생성 실패: " + err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode || !profile) return;
    setLoading(true);
    try {
      const roomRef = doc(db, "rooms", joinCode);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        alert("방을 찾을 수 없습니다.");
        return;
      }
      
      const roomData = roomSnap.data() as Room;
      if (roomData.members.includes(profile.uid)) {
        onEnterRoom(joinCode);
        return;
      }

      const currentMembers = roomData.members || [];
      const maxMembersLimit = Number(roomData.maxMembers);

      if (currentMembers.length >= maxMembersLimit) {
        alert("방이 가득 찼습니다.");
        return;
      }

      await updateDoc(roomRef, {
        members: arrayUnion(profile.uid)
      });
      await updateDoc(doc(db, "users", profile.uid), {
        roomIds: arrayUnion(joinCode)
      });
      
      setShowJoin(false);
      onEnterRoom(joinCode);
    } catch (err) {
      alert("입장 실패: " + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 pt-4">
      <DashboardHeader roomCount={rooms.length} onHelpClick={() => setShowHelp(true)} />
      
      <ActionButtons 
        onCreateClick={() => setShowCreate(true)} 
        onJoinClick={() => setShowJoin(true)} 
      />

      <RoomList rooms={rooms} onEnterRoom={onEnterRoom} />

      <AnimatePresence>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
        
        {showCreate && (
          <RoomModal 
            type="create"
            onClose={() => setShowCreate(false)}
            onSubmit={handleCreate}
            loading={loading}
            name={newRoomName}
            setName={setNewRoomName}
            time={newRoomTime}
            setTime={setNewRoomTime}
            maxMembers={maxMembers}
            setMaxMembers={setMaxMembers}
          />
        )}

        {showJoin && (
          <RoomModal 
            type="join"
            onClose={() => setShowJoin(false)}
            onSubmit={handleJoin}
            loading={loading}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
