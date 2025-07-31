
"use client";

import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GameType } from '@/lib/types';
import { Swords, Grip, AppWindow } from 'lucide-react';

interface GameCenterViewProps {
  onInvite: (gameType: GameType) => void;
  isGuest?: boolean;
}

const games: { type: GameType, name: string, description: string, icon: React.ReactNode, guestAllowed: boolean }[] = [
    { type: 'ticTacToe', name: 'Tic-Tac-Toe', description: 'classNameic 3-in-a-row.', icon: <Grip />, guestAllowed: true },
    { type: 'connectFour', name: 'Connect Four', description: 'Get four of your discs in a row.', icon: <Swords />, guestAllowed: false },
    { type: 'dotsAndBoxes', name: 'Dots and Boxes', description: 'Complete boxes to score points.', icon: <AppWindow />, guestAllowed: false },
]

export default function GameCenterView({ onInvite, isGuest }: GameCenterViewProps) {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Game Center</DialogTitle>
        <DialogDescription>
          Choose a game to play with your opponent.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {games.map(game => (
          <Button 
            key={game.type}
            variant="outline" 
            className="w-full h-auto justify-start p-4"
            onClick={() => onInvite(game.type)}
            disabled={isGuest && !game.guestAllowed}
          >
            <div className="mr-4 text-primary">
                {game.icon}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-base">{game.name}</h3>
              <p className="text-sm text-muted-foreground">{game.description}</p>
               {isGuest && !game.guestAllowed && <p className="text-xs text-destructive">Sign up to play!</p>}
            </div>
          </Button>
        ))}
      </div>
    </DialogContent>
  );
}
