
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ConnectFourState } from '@/lib/types';
import { getFirestore, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface ConnectFourProps {
    game: ConnectFourState;
    currentUserId: string;
    onAcceptGame: () => void;
    onQuitGame: () => void;
}

const Cell = ({ player }: { player: number | null }) => {
    return (
        <div className="aspect-square bg-secondary rounded-full flex items-center justify-center">
           {player && <div className={cn("w-5/6 h-5/6 rounded-full", player === 1 ? 'bg-primary' : 'bg-accent')} />}
        </div>
    )
};


export default function ConnectFour({ game, currentUserId, onAcceptGame, onQuitGame }: ConnectFourProps) {
    const isMyTurn = game.turn === currentUserId;
    const mySymbol = game.players[currentUserId];
    const { toast } = useToast();
    const db = getFirestore(firebaseApp);
    const { user: authUser } = useAuth();

    const handleMove = async (colIndex: number) => {
        if (!authUser) return;
        
        const chatId = [game.players[1] === 1 ? Object.keys(game.players)[0] : Object.keys(game.players)[1], game.players[2] === 2 ? Object.keys(game.players)[1] : Object.keys(game.players)[0]].sort().join('_')
        const chatRef = doc(db, 'chats', chatId);

        try {
            await runTransaction(db, async (transaction) => {
                const freshChatDoc = await transaction.get(chatRef);
                if (!freshChatDoc.exists()) throw new Error("Chat does not exist");
                
                const freshGame = freshChatDoc.data().game as ConnectFourState;
                if (!freshGame || freshGame.turn !== authUser.uid || freshGame.status !== 'active') return;

                const newBoard = [...freshGame.board];
                let landingRow = -1;
                for (let r = 5; r >= 0; r--) {
                    if (newBoard[colIndex + r * 7] === null) {
                        landingRow = r;
                        break;
                    }
                }
                if (landingRow === -1) {
                    toast({variant: 'destructive', title: 'Invalid Move', description: 'This column is full.'})
                    return;
                }

                newBoard[colIndex + landingRow * 7] = freshGame.players[authUser.uid];

                const checkWinner = (board: (number | null)[], player: 1 | 2): boolean => {
                    const R = 6, C = 7;
                    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
                        if (c + 3 < C && board[c+r*C] === player && board[c+1+r*C] === player && board[c+2+r*C] === player && board[c+3+r*C] === player) return true;
                        if (r + 3 < R && board[c+r*C] === player && board[c+(r+1)*C] === player && board[c+(r+2)*C] === player && board[c+(r+3)*C] === player) return true;
                        if (c + 3 < C && r + 3 < R && board[c+r*C] === player && board[c+1+(r+1)*C] === player && board[c+2+(r+2)*C] === player && board[c+3+(r+3)*C] === player) return true;
                        if (c + 3 < C && r - 3 >= 0 && board[c+r*C] === player && board[c+1+(r-1)*C] === player && board[c+2+(r-2)*C] === player && board[c+3+(r-3)*C] === player) return true;
                    }
                    return false;
                };

                const winnerFound = checkWinner(newBoard, freshGame.players[authUser.uid]);
                const isDraw = newBoard.every(cell => cell !== null);
                let newStatus: 'active' | 'finished' | 'draw' = 'active';
                let newWinner: string | null = null;
                
                const partnerId = Object.keys(freshGame.players).find(id => id !== authUser.uid)!;

                if (winnerFound) {
                    newStatus = 'finished';
                    newWinner = authUser.uid;
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
          console.error("Connect Four move transaction failed:", e);
          toast({ variant: 'destructive', title: "Error", description: "Could not make move." });
        }
    };
    
    const getStatusText = () => {
        if (game.status === 'pending') {
            if (game.initiatorId !== currentUserId) {
                return (
                    <div className="text-center space-y-4">
                        <p>Your opponent has invited you to play Connect Four!</p>
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
        
        if (isMyTurn) return (
            <div className="flex items-center justify-center gap-2">Your turn <div className={cn("w-4 h-4 rounded-full", mySymbol === 1 ? 'bg-primary' : 'bg-accent')} /></div>
        );
        return "Opponent's turn";
    };


    return (
        <Card className="h-full flex flex-col border-0 rounded-none shadow-none bg-background">
        <CardHeader>
            <CardTitle>Connect Four</CardTitle>
            <CardDescription className="min-h-[40px] flex items-center justify-center text-center">
                {getStatusText()}
            </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
            <div className="grid grid-cols-7 gap-1 bg-blue-600 p-2 rounded-md">
            {Array.from({length: 7}).map((_, colIndex) => (
                <div key={colIndex} className="flex flex-col-reverse gap-1" >
                    {Array.from({length: 6}).map((_, rowIndex) => {
                         const cellIndex = colIndex + rowIndex * 7;
                         const player = game.board[cellIndex];
                         return (
                            <button
                                key={rowIndex}
                                onClick={() => handleMove(colIndex)}
                                disabled={!isMyTurn || game.status !== 'active'}
                                className="w-10 h-10 hover:bg-blue-500 rounded-full transition-colors"
                                aria-label={`Drop in column ${colIndex + 1}`}
                            >
                                <Cell player={player} />
                            </button>
                         )
                    })}
                </div>
            ))}
            </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
            {game.status !== 'pending' && <Button variant="destructive" className="w-full" onClick={onQuitGame}>Quit Game</Button>}
        </CardFooter>
        </Card>
    );
}

