
"use client";

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { GameState } from '@/lib/types';
import { doc, getFirestore, runTransaction, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DotsAndBoxesProps {
    chatId: string;
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
}

export default function DotsAndBoxes({ chatId, gameState, setGameState }: DotsAndBoxesProps) {
    const { user } = useAuth();
    const db = getFirestore(firebaseApp);
    const { status, players, turn, scores, gridSize, h_lines, v_lines, boxes } = gameState;

    const myPlayerId = user ? players[user.uid] as string : null;
    const isMyTurn = turn === user?.uid;

    const handleMove = async (type: 'h' | 'v', index: number) => {
        if (!isMyTurn || status !== 'active') return;
        if ((type === 'h' && h_lines[index]) || (type === 'v' && v_lines[index])) return;

        const chatRef = doc(db, 'chats', chatId);
        
        // Optimistic update
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
        
        const partnerId = Object.keys(players).find(id => id !== user!.uid)!;
        tempState.turn = (boxesCompleted > 0) ? user!.uid : partnerId;
        
        if(Object.values(tempState.scores).reduce((a:number,b:number) => a+b, 0) === gridSize * gridSize){
            tempState.status = tempState.scores[user!.uid] === tempState.scores[partnerId] ? 'draw' : 'win';
            tempState.turn = null;
        }
        setGameState(tempState);

        try {
            await runTransaction(db, async (transaction) => {
                const chatDoc = await transaction.get(chatRef);
                if (!chatDoc.exists()) throw "Chat does not exist!";
                const game = chatDoc.data().game as GameState;
                if(game.turn !== user?.uid) return; // Abort if state changed
                
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
        if(status === 'win') {
            const myScore = scores[user!.uid];
            const partnerScore = scores[Object.keys(scores).find(id => id !== user!.uid)!];
            return myScore > partnerScore ? "You win! 🎉" : "You lose. 😥";
        }
        return "";
    };

    const handleQuit = async () => {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { game: null });
    };

    return (
        <div className="p-4 h-full flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-lg mb-2">Dots & Boxes</h3>
             <div className="text-center text-sm">
                <div><span className={cn(players[user!.uid] === 'p1' ? "text-yellow-400" : "text-red-500")}>You: {scores[user!.uid]}</span> | <span>Opponent: {scores[Object.keys(scores).find(id => id !== user!.uid)!]}</span></div>
                <div className="mt-1 h-5">{getStatusText()}</div>
             </div>
             <div className="p-4">
                {Array.from({ length: gridSize + 1 }).map((_, r) => (
                    <React.Fragment key={r}>
                    <div className="flex">
                        {Array.from({ length: gridSize + 1 }).map((_, c) => (
                        <React.Fragment key={c}>
                            <div className="w-2.5 h-2.5 bg-muted-foreground rounded-full" />
                            {c < gridSize && (
                            <button
                                className={cn("flex-grow h-2.5 mx-1", h_lines[r*gridSize+c] ? (players[h_lines[r*gridSize+c]]==='p1' ? 'bg-yellow-400' : 'bg-red-500') : "bg-secondary hover:bg-primary")}
                                onClick={() => handleMove('h', r * gridSize + c)}
                                disabled={!isMyTurn || !!h_lines[r * gridSize + c] || status !== 'active'}
                            />
                            )}
                        </React.Fragment>
                        ))}
                    </div>
                    {r < gridSize && (
                        <div className="flex">
                        {Array.from({ length: gridSize + 1 }).map((_, c) => (
                            <React.Fragment key={c}>
                            <button
                                className={cn("w-2.5 my-1 flex-grow", v_lines[r*(gridSize+1)+c] ? (players[v_lines[r*(gridSize+1)+c]]==='p1' ? 'bg-yellow-400' : 'bg-red-500') : "bg-secondary hover:bg-primary")}
                                onClick={() => handleMove('v', r * (gridSize + 1) + c)}
                                disabled={!isMyTurn || !!v_lines[r * (gridSize + 1) + c] || status !== 'active'}
                            />
                            {c < gridSize && <div className={cn("w-[calc(100%/4-0.625rem)] aspect-square", boxes[r*gridSize+c] && (players[boxes[r*gridSize+c]] === 'p1' ? 'bg-yellow-400/20' : 'bg-red-400/20'))} />}
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
