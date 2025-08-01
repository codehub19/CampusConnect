
"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import type { GameState } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';


interface GameCenterViewProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  chatId: string;
  partnerId: string;
}

export default function GameCenterView({ isOpen, onOpenChange, chatId, partnerId }: GameCenterViewProps) {
  const { user, profile } = useAuth();
  const db = getFirestore(firebaseApp);

  const inviteToGame = async (gameType: 'tic-tac-toe' | 'connect-four' | 'dots-and-boxes') => {
    if (!user) return;
    
    let initialGameState: GameState = {
        type: gameType,
        status: 'pending',
        initiatorId: user.uid,
        winner: null,
        turn: null,
        players: {},
        board: [],
    };
    
    if (gameType === 'tic-tac-toe') {
        initialGameState.players = { [user.uid]: null, [partnerId]: null };
        initialGameState.board = Array(9).fill(null);
    } else if (gameType === 'connect-four') {
        initialGameState.players = { [user.uid]: 1, [partnerId]: 2 };
        initialGameState.board = Array(42).fill(null);
    } else if (gameType === 'dots-and-boxes') {
        const gridSize = 4;
        initialGameState.gridSize = gridSize;
        initialGameState.h_lines = Array((gridSize + 1) * gridSize).fill(null);
        initialGameState.v_lines = Array(gridSize * (gridSize + 1)).fill(null);
        initialGameState.boxes = Array(gridSize * gridSize).fill(null);
        initialGameState.scores = { [user.uid]: 0, [partnerId]: 0 };
        initialGameState.players = { [user.uid]: 'p1', [partnerId]: 'p2' };
        initialGameState.board = []; // not used but keeps type consistent
    }

    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, { game: initialGameState });
    onOpenChange(false);
    toast({ title: "Game Invite Sent!", description: "Waiting for your partner to accept."})
  }
  
  const isGuest = profile?.isGuest;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Game Center</DialogTitle>
          <DialogDescription>Challenge your chat partner to a game.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <Button 
                onClick={() => inviteToGame('tic-tac-toe')} 
                variant="secondary" 
                className="w-full justify-start h-auto text-left p-4"
            >
                <div>
                    <h3 className="font-bold text-lg">Tic-Tac-Toe</h3>
                    <p className="text-sm text-muted-foreground">Classic 3-in-a-row game.</p>
                </div>
            </Button>
             <Button 
                onClick={() => inviteToGame('connect-four')} 
                variant="secondary" 
                className="w-full justify-start h-auto text-left p-4"
                disabled={isGuest}
                title={isGuest ? 'Sign up to play this game' : ''}
            >
                <div>
                    <h3 className="font-bold text-lg">Connect Four</h3>
                    <p className="text-sm text-muted-foreground">Get four of your discs in a row to win.</p>
                </div>
            </Button>
            <Button 
                onClick={() => inviteToGame('dots-and-boxes')} 
                variant="secondary" 
                className="w-full justify-start h-auto text-left p-4"
                disabled={isGuest}
                title={isGuest ? 'Sign up to play this game' : ''}
            >
                <div>
                    <h3 className="font-bold text-lg">Dots and Boxes</h3>
                    <p className="text-sm text-muted-foreground">Complete boxes to score points.</p>
                </div>
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
