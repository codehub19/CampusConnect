import type { User, Chat, Message } from './types';

export const currentUser: User = {
  id: 'user-0',
  name: 'You',
  avatar: 'https://placehold.co/100x100',
  online: true,
  gender: 'Prefer not to say',
  interests: ['Gaming', 'Music', 'Sports'],
};

export const users: User[] = [
  { id: 'user-1', name: 'Alex Doe', avatar: 'https://placehold.co/100x100/4F46E5/FFFFFF', online: true, gender: 'Male', interests: ['Music', 'Art'] },
  { id: 'user-2', name: 'Samantha Roe', avatar: 'https://placehold.co/100x100/FBBC24/121820', online: false, gender: 'Female', interests: ['Sports', 'Movies'] },
  { id: 'user-3', name: 'Jordan Smith', avatar: 'https://placehold.co/100x100/34D399/121820', online: true, gender: 'Other', interests: ['Gaming', 'Coding'] },
  { id: 'user-4', name: 'Taylor Brown', avatar: 'https://placehold.co/100x100/F472B6/121820', online: false, gender: 'Female', interests: ['Reading', 'Hiking'] },
  { id: 'user-5', name: 'Casey Green', avatar: 'https://placehold.co/100x100/8B5CF6/FFFFFF', online: true, gender: 'Male', interests: ['Cooking', 'Music'] },
];

const generateMessages = (userId1: string, userId2: string): Message[] => {
  return [
    { id: 'msg-1', senderId: userId2, text: 'Hey, how is it going?', timestamp: new Date(Date.now() - 1000 * 60 * 5) },
    { id: 'msg-2', senderId: userId1, text: 'Hey! Pretty good, just studying for finals. You?', timestamp: new Date(Date.now() - 1000 * 60 * 4) },
    { id: 'msg-3', senderId: userId2, text: 'Same here. Need a break though. Wanna play a game?', timestamp: new Date(Date.now() - 1000 * 60 * 3) },
    { id: 'msg-4', senderId: userId1, text: 'Sure! Tic-Tac-Toe?', timestamp: new Date(Date.now() - 1000 * 60 * 2) },
  ];
};

export const chats: Chat[] = users.map(user => ({
  id: `chat-${user.id}`,
  userIds: [currentUser.id, user.id],
  messages: generateMessages(currentUser.id, user.id),
}));
