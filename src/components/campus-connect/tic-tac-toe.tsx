
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TicTacToeState } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getFirestore, doc, runTransaction } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';

interface TicTacToeProps {
    game: TicTacToeState;
    currentUserId: string;
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

export default function TicTacToe({ game, currentUserId, onAcceptGame, onQuitGame }: TicTacToeProps) {
  const isMyTurn = game.turn === currentUserId;
  const mySymbol = game.players[currentUserId];
  const { toast } = useToast();
  const db = getFirestore(firebaseApp);
  const { user: authUser } = useAuth();
  
  const handleMakeMove = async (index: number) => {
    if (!authUser) return;
    const partnerId = Object.keys(game.players).find(id => id !== authUser.uid)!;
    const chatId = [authUser.uid, partnerId].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);

    try {
      await runTransaction(db, async (transaction) => {
        const freshChatDoc = await transaction.get(chatRef);
        if (!freshChatDoc.exists()) throw new Error("Chat does not exist");
        
        const freshGame = freshChatDoc.data().game as TicTacToeState;
        if (!freshGame || freshGame.turn !== authUser.uid || freshGame.board[index] !== null || freshGame.status !== 'active') return;

        const newBoard = [...freshGame.board];
        newBoard[index] = freshGame.players[authUser.uid];

        const calculateWinner = (squares: any[]) => {
            const lines = [
              [0, 1, 2], [3, 4, 5], [6, 7, 8],
              [0, 3, 6], [1, 4, 7], [2, 5, 8],
              [0, 4, 8], [2, 4, 6],
            ];
            for (let i = 0; i < lines.length; i++) {
              const [a, b, c] = lines[i];
              if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
            }
            return null;
        };
        
        const winnerSymbol = calculateWinner(newBoard);
        const isDraw = newBoard.every(cell => cell !== null);
        let newStatus: 'active' | 'finished' | 'draw' = 'active';
        let newWinner: string | null = null;
        
        if (winnerSymbol) {
            newStatus = 'finished';
            newWinner = Object.keys(freshGame.players).find(key => freshGame.players[key] === winnerSymbol) || null;
        } else if (isDraw) {
            newStatus = 'draw';
        }

        const newGameData = {
          ...freshGame,
          board: newBoard,
          turn: newStatus === 'active' ? partnerId : null,
          status: newStatus,
          winner: newWinner,
        };

        transaction.update(chatRef, { game: newGameData });
      });
    } catch (e) {
      console.error("Game move transaction failed:", e);
      toast({ variant: 'destructive', title: "Error", description: "Could not make move." });
    }
  };


  const getStatusText = () => {
    if (game.status === 'pending') {
        if (game.initiatorId !== currentUserId) {
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
        if (game.winner === currentUserId) return "You win!";
        return "You lose!";
    }
     if (game.status === 'draw') return "It's a draw!";

    if (isMyTurn) return `Your turn (${mySymbol})`;
    return "Opponent's turn";
  };


  return (
    <Card className="h-full flex flex-col border-0 rounded-none shadow-none bg-background">
      <CardHeader>
        <CardTitle>Tic-Tac-Toe</CardTitle>
        <CardDescription className="min-h-[40px] flex items-center justify-center text-center">
            {getStatusText()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex items-center justify-center">
        <div className="grid grid-cols-3 gap-2">
          {game.board.map((square, i) => (
            <Square 
                key={i} 
                value={square} 
                onSquareClick={() => handleMakeMove(i)} 
                disabled={game.status !== 'active' || !isMyTurn || square !== null}
            />
          ))}
        </div>
      </CardContent>
       <CardFooter className="flex-col gap-2">
         {game.status !== 'pending' && <Button variant="destructive" className="w-full" onClick={onQuitGame}>Quit Game</Button>}
      </CardFooter>
    </Card>
  );
}
