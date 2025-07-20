
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
  timestamp: Date;
}

export interface GameState {
    type: 'ticTacToe';
    status: 'pending' | 'active' | 'finished';
    board: (string | null)[];
    turn: string;
    players: { [key: string]: 'X' | 'O' };
    winner: string | null | 'draw';
}

export interface Chat {
  id: string;
  userIds: string[];
  messages: Message[];
  game: GameState | null;
  users?: User[]; // Optional: for client-side convenience
}

export interface FriendRequest {
    id: string;
    fromId: string;
    toId: string;
    fromName: string;
    fromAvatar: string;
    status: 'pending' | 'accepted' | 'declined';
    timestamp: Date;
}
