import React from 'react';
import { motion } from 'motion/react';
import { Room } from '../../types';
import { Calendar, Users, DoorOpen } from 'lucide-react';

interface RoomListProps {
  rooms: Room[];
  onEnterRoom: (id: string) => void;
}

export function RoomList({ rooms, onEnterRoom }: RoomListProps) {
  const sortedRooms = [...rooms].sort((a, b) => {
    const dateA = a.lastActiveDate || '';
    const dateB = b.lastActiveDate || '';
    return dateB.localeCompare(dateA);
  });

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">참여 중인 책장</h3>
      {rooms.length === 0 ? (
        <div className="text-center py-16 glass rounded-[3rem] border-dashed border-slate-200">
          <p className="text-slate-400 font-bold text-sm italic">
            "텅 비어있어요. 상상을 채워보세요!"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sortedRooms.map(room => (
            <RoomCard key={room.id} room={room} onClick={() => onEnterRoom(room.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

interface RoomCardProps {
  key?: string;
  room: Room;
  onClick: () => void;
}

function RoomCard({ room, onClick }: RoomCardProps) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={onClick}
      className="flex items-center justify-between glass card-child text-left group overflow-hidden relative"
    >
      <div className="space-y-3 relative">
        <h4 className="font-black text-2xl text-slate-900 group-hover:text-brand-key transition-colors tracking-tight">{room.name}</h4>
        <div className="flex items-center gap-3 text-xs font-black">
          <span className="flex items-center gap-1.5 glass-dark px-3 py-1.5 rounded-xl uppercase text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-brand-key" /> {room.dailyTime}
          </span>
          <span className="flex items-center gap-1.5 glass-dark px-3 py-1.5 rounded-xl uppercase text-slate-600">
            <Users className="w-3.5 h-3.5 text-blue-600" /> {room.members.length}/4
          </span>
        </div>
      </div>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white group-hover:bg-brand-key/20 transition-all border-white/5 relative">
        <DoorOpen className="w-6 h-6" />
      </div>
    </motion.button>
  );
}
