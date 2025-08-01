
export interface User {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  interests: string[];
  isGuest?: boolean;
  blockedUsers?: string[];
  profileComplete?: boolean;
  groupName?: string; // For displaying name in group chats
  pendingChatId?: string | null;
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
  text?: string; // Kept for backwards compatibility and simple text use
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
  authorName: string; // Keep for internal reference, but don't display
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
