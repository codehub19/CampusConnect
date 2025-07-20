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

export interface Chat {
  id: string;
  userIds: string[];
  messages: Message[];
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
