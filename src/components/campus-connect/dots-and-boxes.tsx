
"use client";

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { GameState } from '@/lib/types';
import { doc, getFirestore, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface DotsAndBoxesProps {
    chatId: string;
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
}

export default function DotsAndBoxes({ chatId, gameState, setGameState }: DotsAndBoxesProps) {
    const { user } = useAuth();
    const db = getFirestore(firebaseApp);
    const { status, players, turn, scores, gridSize, h_lines, v_lines, boxes, winner } = gameState;

    const myPlayerId = user ? players[user.uid] as string : null;
    const isMyTurn = turn === user?.uid;
    const partnerId = Object.keys(players).find(id => id !== user?.uid)!;

    const handleMove = async (type: 'h' | 'v', index: number) => {
        if (!isMyTurn || status !== 'active') return;
        if ((type === 'h' && h_lines[index]) || (type === 'v' && v_lines[index])) return;

        const chatRef = doc(db, 'chats', chatId);

        const tempState = JSON.parse(JSON.stringify(gameState));
        if (type === 'h') tempState.h_lines[index] = user!.uid;
        else tempState.v_lines[index] = user!.uid;

        let boxesCompleted = 0;
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const boxIndex = r * gridSize + c;
                if (!tempState.boxes[boxIndex] &&
                    tempState.h_lines[r * gridSize + c] &&
                    tempState.h_lines[(r + 1) * gridSize + c] &&
                    tempState.v_lines[r * (gridSize + 1) + c] &&
                    tempState.v_lines[r * (gridSize + 1) + (c + 1)]
                ) {
                    tempState.boxes[boxIndex] = user!.uid;
                    tempState.scores[user!.uid]++;
                    boxesCompleted++;
                }
            }
        }
        
        tempState.turn = (boxesCompleted > 0) ? user!.uid : partnerId;
        
        const totalScore = Object.values(tempState.scores).reduce((a, b) => (a as number) + (b as number), 0);
        if (totalScore === gridSize * gridSize) {
            tempState.status = tempState.scores[user!.uid] === tempState.scores[partnerId] ? 'draw' : 'win';
            tempState.winner = tempState.scores[user!.uid] > tempState.scores[partnerId] ? user!.uid : (tempState.scores[user!.uid] < tempState.scores[partnerId] ? partnerId : null);
            tempState.turn = null;
        }

        setGameState(tempState);

        try {
            await updateDoc(chatRef, { game: tempState });
        } catch (e) {
             console.error("Dots and Boxes move failed: ", e);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not make move. The game may be out of sync.' });
        }
    };
    
    const getStatusText = () => {
        if (status === 'pending') return "Waiting for opponent...";
        if (status === 'active') return isMyTurn ? "Your turn" : "Opponent's turn";
        if (status === 'draw') return "It's a draw!";
        if (status === 'win') {
            return winner === user?.uid ? "You win! 🎉" : "You lose. 😥";
        }
        return "";
    };

    const handleQuit = async () => {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { game: null });
    };

    const PlayerPill = ({ playerId, score }: { playerId: string, score: number }) => {
        const playerColor = players[playerId] === 'p1' ? 'bg-yellow-400' : 'bg-red-500';
        const name = playerId === user?.uid ? 'You' : 'Opponent';
        return (
            <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold", turn === playerId ? 'bg-primary/20' : 'bg-secondary')}>
                <div className={cn("h-3 w-3 rounded-full", playerColor)}></div>
                <span className="text-foreground/80">{name}:</span>
                <span className="font-bold text-foreground">{score}</span>
            </div>
        )
    };

    const gridDimensions = gridSize * 2 + 1;

    return (
        <div className="p-4 h-full flex flex-col items-center justify-center text-center bg-background">
            <h3 className="font-bold text-lg mb-2">Dots & Boxes</h3>
            <div className="flex gap-2 items-center mb-2">
                <PlayerPill playerId={user!.uid} score={scores[user!.uid]}/>
                <PlayerPill playerId={partnerId} score={scores[partnerId]}/>
            </div>
             <div className="text-center text-sm h-6 mb-2">
                <p>{getStatusText()}</p>
             </div>
             <div 
                className="grid p-4" 
                style={{ 
                    gridTemplateColumns: `repeat(${gridDimensions}, auto)`,
                    gridTemplateRows: `repeat(${gridDimensions}, auto)`,
                }}
            >
                {Array.from({ length: gridDimensions * gridDimensions }).map((_, i) => {
                    const row = Math.floor(i / gridDimensions);
                    const col = i % gridDimensions;

                    // Dot
                    if (row % 2 === 0 && col % 2 === 0) {
                        return <div key={i} className="w-3 h-3 bg-muted rounded-full" />;
                    }

                    // Horizontal Line
                    if (row % 2 === 0 && col % 2 !== 0) {
                        const r = row / 2;
                        const c = (col - 1) / 2;
                        const lineIndex = r * gridSize + c;
                        const lineOwner = h_lines[lineIndex];
                        return (
                             <button
                                key={i}
                                onClick={() => handleMove('h', lineIndex)}
                                disabled={!isMyTurn || !!lineOwner || status !== 'active'}
                                className={cn(
                                    "w-12 h-3 flex items-center justify-center transition-all",
                                    !lineOwner && "cursor-pointer"
                                )}
                            >
                                <div className={cn(
                                    "w-full h-1 rounded-full",
                                    !lineOwner && "bg-secondary hover:bg-primary/50",
                                    lineOwner && (players[lineOwner] === 'p1' ? 'bg-yellow-400' : 'bg-red-500')
                                )}/>
                            </button>
                        );
                    }

                    // Vertical Line
                    if (row % 2 !== 0 && col % 2 === 0) {
                        const r = (row - 1) / 2;
                        const c = col / 2;
                        const lineIndex = r * (gridSize + 1) + c;
                        const lineOwner = v_lines[lineIndex];
                        return (
                            <button
                                key={i}
                                onClick={() => handleMove('v', lineIndex)}
                                disabled={!isMyTurn || !!lineOwner || status !== 'active'}
                                className={cn(
                                    "w-3 h-12 flex items-center justify-center transition-all",
                                    !lineOwner && "cursor-pointer"
                                )}
                            >
                                <div className={cn(
                                    "w-1 h-full rounded-full",
                                    !lineOwner && "bg-secondary hover:bg-primary/50",
                                     lineOwner && (players[lineOwner] === 'p1' ? 'bg-yellow-400' : 'bg-red-500')
                                )}/>
                            </button>
                        );
                    }
                    
                    // Box
                    if (row % 2 !== 0 && col % 2 !== 0) {
                        const r = (row-1)/2;
                        const c = (col-1)/2;
                        const boxIndex = r * gridSize + c;
                        const boxOwner = boxes[boxIndex];
                        return (
                             <div key={i} className={cn("w-12 h-12 flex items-center justify-center transition-colors", boxOwner && (players[boxOwner] === 'p1' ? 'bg-yellow-400/20' : 'bg-red-500/20'))}>
                                {boxOwner && (
                                    <Avatar className={cn("h-8 w-8 opacity-50", players[boxOwner] === 'p1' ? 'bg-yellow-400' : 'bg-red-500')}>
                                        <AvatarFallback className="bg-transparent text-lg font-bold text-white">
                                            {boxOwner === user?.uid ? 'Y' : 'O'}
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        )
                    }

                    return null;
                })}
             </div>
             {(status === 'win' || status === 'draw') ? (
                 <Button onClick={() => {
                    const gameCenter = document.querySelector<HTMLButtonElement>('[data-game-center-trigger]');
                    if(gameCenter) gameCenter.click();
                 }} variant="secondary" className="mt-4">Play Another Game</Button>
            ) : (
                 <Button onClick={handleQuit} variant="destructive" className="mt-4">Quit Game</Button>
            )}
        </div>
    );
}
