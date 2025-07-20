
export interface User {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  interests: string[];
  isGuest?: boolean;
  friends?: string[];
  blockedUsers?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
}

export interface GameState {
    type: 'ticTacToe';
    status: 'pending' | 'active' | 'finished';
    board: (string | null)[];
    turn: string | null;
    players: { [key: string]: 'X' | 'O' };
    winner: string | null | 'draw';
}

export interface Chat {
  id: string;
  userIds: string[];
  users?: User[]; // Optional: for client-side convenience
  game: GameState | null;
  lastMessageTimestamp?: any;
  call?: {
    offer: any;
    answer?: any;
    callerId: string;
  }
}

export interface FriendRequest {
    id: string;
    fromId: string;
    toId: string;
    fromName: string;
    fromAvatar: string;
    status: 'pending' | 'accepted' | 'declined';
    timestamp: any;
}
