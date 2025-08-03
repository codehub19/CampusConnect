
import type { User as FirebaseUser } from 'firebase/auth';

export interface User {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  profileComplete?: boolean;
  gender: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  preference: 'anyone' | 'males' | 'females';
  interests: string[];
  major?: string;
  year?: string;
  bio?: string;
  blockedUsers?: string[];
  friends?: string[];
  pendingChatId?: string | null;
  matchedChatId?: string | null; // Used for matchmaking
  uid?: string; // from waiting_users
  lastSeen?: any;
}

export interface Chat {
  id: string;
  memberIds: string[];
  members: {
    [uid: string]: {
      name: string;
      avatar: string;
      online: boolean;
      active: boolean;
    }
  };
  isFriendChat?: boolean;
  lastMessage?: {
    text: string;
    timestamp: any;
  };
  createdAt: any;
  game?: GameState | null;
}

export type MessageContent = 
    | { type: 'text', value: string }
    | { type: 'image', value: { url: string, name: string } }
    | { type: 'video', value: { url: string, name: string } }
    | { type: 'file', value: { url: string, name: string } };

export interface Message {
  id: string;
  senderId: string;
  content: MessageContent;
  timestamp: any;
  text?: string; 
  status?: 'sent' | 'read';
}

export interface MissedConnectionComment {
  id: string;
  authorId: string;
  text: string;
  timestamp: any;
}

export interface MissedConnectionPost {
  id: string;
  title: string;
  content: string;
  location: string;
  timeOfDay: string;
  authorId: string;
  authorName: string; 
  timestamp: any;
  status: 'pending' | 'approved' | 'rejected';
  reportCount?: number;
}

export interface PostRestriction {
  userId: string;
  expires: any; // Firestore Timestamp
}

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  date: any; // Start date
  endDate?: any; // Optional end date for multi-day events
  category: string;
  cost?: string;
  capacity?: number | null;
  organizer: string;
  imageUrl: string;
  chatId: string;
  authorId: string;
  timestamp: any;
}

export interface WaitingUser {
  uid: string;
  name: string;
  gender: User['gender'];
  preference: User['preference'];
  timestamp: any;
  matchedChatId?: string;
}

// Games
export interface GameState {
  gameType: 'tic-tac-toe' | 'connect-four' | 'dots-and-boxes';
  type: 'tic-tac-toe' | 'connect-four' | 'dots-and-boxes';
  status: 'pending' | 'active' | 'win' | 'draw';
  initiatorId: string;
  turn: string | null;
  winner: string | null;
  players: { [key: string]: 'X' | 'O' | 1 | 2 | 'p1' | 'p2' | null };
  board: any[];
  [key: string]: any; // for game-specific properties
}

export interface Call {
    offer: any;
    answer?: any;
    answered: boolean;
    callerId: string;
}

export interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: any;
}
