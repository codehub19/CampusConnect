
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { GameState } from '@/lib/types';

interface TicTacToeProps {
    game: GameState;
    currentUserId: string;
    onMakeMove: (index: number) => void;
    onAcceptGame: () => void;
    onQuitGame: () => void;
}

const Square = ({ value, onSquareClick, disabled }: { value: string | null; onSquareClick: () => void, disabled: boolean }) => {
  return (
    <button
      className={cn(
        "h-20 w-20 md:h-24 md:w-24 bg-secondary flex items-center justify-center rounded-lg shadow-md transition-all duration-150 ease-out",
        !disabled && "hover:scale-105 hover:bg-primary/20",
        value === 'X' ? 'text-primary' : 'text-accent'
      )}
      onClick={onSquareClick}
      disabled={disabled}
    >
      {value && <span className="text-5xl font-bold">{value}</span>}
    </button>
  );
};

export default function TicTacToe({ game, currentUserId, onMakeMove, onAcceptGame, onQuitGame }: TicTacToeProps) {
  const isMyTurn = game.turn === currentUserId;
  const mySymbol = game.players[currentUserId];
  const partnerId = Object.keys(game.players).find(id => id !== currentUserId) || '';

  const getStatusText = () => {
    if (game.status === 'pending') {
        if (game.players[currentUserId] === 'O') { // The one who didn't initiate
            return (
                <div className="text-center space-y-4">
                    <p>Your opponent has invited you to play Tic-Tac-Toe!</p>
                    <Button onClick={onAcceptGame} className="w-full">Accept</Button>
                </div>
            )
        }
        return "Waiting for opponent to accept...";
    }
    if (game.status === 'finished') {
        if (game.winner === 'draw') return "It's a draw!";
        if (game.winner === currentUserId) return "You win!";
        return "You lose!";
    }
    if (isMyTurn) return `Your turn (${mySymbol})`;
    return "Opponent's turn";
  };


  return (
    <Card className="h-full flex flex-col border-0 rounded-none shadow-none">
      <CardHeader>
        <CardTitle>Tic-Tac-Toe</CardTitle>
        <CardDescription>{getStatusText()}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex items-center justify-center">
        <div className="grid grid-cols-3 gap-2">
          {game.board.map((square, i) => (
            <Square 
                key={i} 
                value={square} 
                onSquareClick={() => onMakeMove(i)} 
                disabled={game.status !== 'active' || !isMyTurn || square !== null}
            />
          ))}
        </div>
      </CardContent>
       <CardFooter className="flex-col gap-2">
         {game.status === 'finished' && (
            <Button variant="secondary" className="w-full" onClick={() => { /* Implement play again */ }}>Play Again</Button>
         )}
        <Button variant="destructive" className="w-full" onClick={onQuitGame}>Quit Game</Button>
      </CardFooter>
    </Card>
  );
}
