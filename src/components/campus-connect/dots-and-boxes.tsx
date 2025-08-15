
"use client";

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { GameState } from '@/lib/types';
import { doc, getFirestore, runTransaction, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { User } from 'lucide-react';

interface DotsAndBoxesProps {
    chatId: string;
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
}

export default function DotsAndBoxes({ chatId, gameState, setGameState }: DotsAndBoxesProps) {
    const { user, profile } = useAuth();
    const db = getFirestore(firebaseApp);
    const { status, players, turn, scores, gridSize, h_lines, v_lines, boxes } = gameState;

    const myPlayerId = user ? players[user.uid] as string : null;
    const isMyTurn = turn === user?.uid;
    const partnerId = Object.keys(players).find(id => id !== user?.uid)!;

    const handleMove = async (type: 'h' | 'v', index: number) => {
        if (!isMyTurn || status !== 'active') return;
        if ((type === 'h' && h_lines[index]) || (type === 'v' && v_lines[index])) return;

        const chatRef = doc(db, 'chats', chatId);

        // Create a deep copy for the optimistic update
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
        
        const totalScore = Object.values(tempState.scores).reduce((a: number, b: number) => a + b, 0);
        if (totalScore === gridSize * gridSize) {
            tempState.status = tempState.scores[user!.uid] === tempState.scores[partnerId] ? 'draw' : 'win';
            tempState.winner = tempState.scores[user!.uid] > tempState.scores[partnerId] ? user!.uid : (tempState.scores[user!.uid] < tempState.scores[partnerId] ? partnerId : null);
            tempState.turn = null;
        }

        // Apply the optimistic update to the local state
        setGameState(tempState);

        try {
            await runTransaction(db, async (transaction) => {
                const chatDoc = await transaction.get(chatRef);
                if (!chatDoc.exists()) throw "Chat does not exist!";
                const game = chatDoc.data().game as GameState;
                if (game.turn !== user?.uid) return; // Abort if state changed
                if ((type === 'h' && game.h_lines[index]) || (type === 'v' && game.v_lines[index])) return;
                
                transaction.update(chatRef, { game: tempState });
            });
        } catch (e) {
             console.error("Dots and Boxes move failed: ", e);
             toast({ variant: 'destructive', title: 'Error making move' });
             setGameState(gameState); // Revert on error
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
             <div className="p-4">
                {Array.from({ length: gridSize + 1 }).map((_, r) => (
                    <React.Fragment key={r}>
                    <div className="flex justify-center">
                        {Array.from({ length: gridSize + 1 }).map((_, c) => (
                        <React.Fragment key={c}>
                            <div className="w-3 h-3 bg-muted rounded-full" />
                            {c < gridSize && (
                            <button
                                onClick={() => handleMove('h', r * gridSize + c)}
                                disabled={!isMyTurn || !!h_lines[r * gridSize + c] || status !== 'active'}
                                className={cn(
                                    "w-12 h-3 mx-1 rounded-full transition-all",
                                    !h_lines[r * gridSize + c] && "bg-secondary hover:bg-primary/50",
                                    h_lines[r * gridSize + c] && (players[h_lines[r*gridSize+c]] === 'p1' ? 'bg-yellow-400' : 'bg-red-500'),
                                    isMyTurn && !h_lines[r * gridSize + c] && "cursor-pointer"
                                )}
                            />
                            )}
                        </React.Fragment>
                        ))}
                    </div>
                    {r < gridSize && (
                        <div className="flex justify-center">
                        {Array.from({ length: gridSize + 1 }).map((_, c) => (
                            <React.Fragment key={c}>
                            <button
                                onClick={() => handleMove('v', r * (gridSize + 1) + c)}
                                disabled={!isMyTurn || !!v_lines[r * (gridSize + 1) + c] || status !== 'active'}
                                className={cn(
                                    "w-3 h-12 my-1 rounded-full transition-all",
                                    !v_lines[r * (gridSize + 1) + c] && "bg-secondary hover:bg-primary/50",
                                    v_lines[r * (gridSize + 1) + c] && (players[v_lines[r*(gridSize+1)+c]] === 'p1' ? 'bg-yellow-400' : 'bg-red-500'),
                                    isMyTurn && !v_lines[r * (gridSize + 1) + c] && "cursor-pointer"
                                )}
                            />
                            {c < gridSize && <div className={cn("w-12 h-12 flex items-center justify-center", boxes[r*gridSize+c] && (players[boxes[r*gridSize+c]] === 'p1' ? 'bg-yellow-400/20' : 'bg-red-500/20'))}>
                                {boxes[r*gridSize+c] && (
                                    <Avatar className={cn("h-8 w-8 opacity-50", players[boxes[r*gridSize+c]] === 'p1' ? 'bg-yellow-400' : 'bg-red-500')}>
                                        <AvatarFallback className="bg-transparent text-lg font-bold text-white">
                                            {boxes[r*gridSize+c] === user?.uid ? 'Y' : 'O'}
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                            </div>}
                            </React.Fragment>
                        ))}
                        </div>
                    )}
                    </React.Fragment>
                ))}
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
