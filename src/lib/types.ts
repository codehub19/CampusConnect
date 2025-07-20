

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
  profileComplete?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
}

export type GameType = 'ticTacToe' | 'connectFour' | 'dotsAndBoxes';

export interface BaseGameState {
    type: GameType;
    status: 'pending' | 'active' | 'finished' | 'draw';
    winner: string | null;
    initiatorId: string;
    players: { [key: string]: any };
}

export interface TicTacToeState extends BaseGameState {
    type: 'ticTacToe';
    board: (string | null)[];
    turn: string | null;
    players: { [key:string]: 'X' | 'O' };
}

export interface ConnectFourState extends BaseGameState {
    type: 'connectFour';
    board: (number | null)[];
    turn: string | null;
    players: { [key:string]: 1 | 2 };
}

export interface DotsAndBoxesState extends BaseGameState {
    type: 'dotsAndBoxes';
    gridSize: number;
    h_lines: (string | null)[];
    v_lines: (string | null)[];
    boxes: (string | null)[];
    scores: { [key: string]: number };
    turn: string | null;
    players: { [key: string]: 'p1' | 'p2' };
}

export type GameState = TicTacToeState | ConnectFourState | DotsAndBoxesState;


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
  isFriendChat?: boolean;
  usersData?: {
      [key: string]: {
          online: boolean;
      }
  }
  // Group Chat specific fields
  isGroupChat?: boolean;
  groupName?: string;
  groupAvatar?: string;
  groupDescription?: string;
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
}

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  date: any; // Firestore Timestamp
  organizer: string;
  imageUrl: string;
  chatId: string; // Link to the associated group chat
}
