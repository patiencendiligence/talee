export interface UserProfile {
  uid: string;
  nickname: string;
  roomIds: string[];
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  maxMembers: number;
  dailyTime: string; // HH:mm
  lastActiveDate?: string; // YYYY-MM-DD
  dailyStyles?: Record<string, number>; // date (YYYY-MM-DD) -> styleIndex (0-4)
}

export interface Scene {
  id: string;
  roomId: string;
  date: string; // YYYY-MM-DD
  index: number; // 0-4
  text: string;
  imageUrl: string;
  imageType?: 'ai' | 'openai' | 'placeholder' | 'manual';
  isGenerating?: boolean;
  needsRetry?: boolean;
  createdBy: string;
  createdAt: any; // ServerTimestamp
  members?: string[]; // Denormalized for security rules performance
}

export interface ImageCache {
  hash: string;
  imageUrl: string;
  prompt: string;
}
