
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DotsAndBoxesState } from '@/lib/types';
import { getFirestore, doc, runTransaction } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface DotsAndBoxesProps {
    game: DotsAndBoxesState;
    currentUserId: string;
    onAcceptGame: () => void;
    onQuitGame: () => void;
    chatId: string;
}


export default function DotsAndBoxes({ game, currentUserId, onAcceptGame, onQuitGame, chatId }: DotsAndBoxesProps) {
    const isMyTurn = game.turn === currentUserId;
    const { toast } = useToast();
    const db = getFirestore(firebaseApp);
    const { user: authUser } = useAuth();
    
    const partnerId = Object.keys(game.players).find(id => id !== currentUserId)!;

    const handleLineClick = async (type: 'h' | 'v', index: number) => {
        if (!isMyTurn || game.status !== 'active' || !authUser) return;

        const chatRef = doc(db, 'chats', chatId);

        try {
            await runTransaction(db, async (transaction) => {
                const freshChatDoc = await transaction.get(chatRef);
                if (!freshChatDoc.exists()) throw "Chat does not exist!";
                
                const freshGame = freshChatDoc.data().game as DotsAndBoxesState | null;
                if (!freshGame || freshGame.type !== 'dotsAndBoxes' || freshGame.status !== 'active' || freshGame.turn !== authUser.uid) return;
                if ((type === 'h' && freshGame.h_lines[index]) || (type === 'v' && freshGame.v_lines[index])) return;

                const { gridSize } = freshGame;
                const h_lines = [...freshGame.h_lines];
                const v_lines = [...freshGame.v_lines];
                const boxes = [...freshGame.boxes];
                const scores = { ...freshGame.scores };
                
                if (type === 'h') h_lines[index] = authUser.uid;
                else v_lines[index] = authUser.uid;

                let boxesCompletedThisTurn = 0;
                for (let r = 0; r < gridSize; r++) {
                    for (let c = 0; c < gridSize; c++) {
                        const boxIndex = r * gridSize + c;
                        if (boxes[boxIndex]) continue;

                        const top = h_lines[r * (gridSize) + c];
                        const bottom = h_lines[(r + 1) * (gridSize) + c];
                        const left = v_lines[r * (gridSize + 1) + c];
                        const right = v_lines[r * (gridSize + 1) + (c + 1)];

                        if (top && bottom && left && right) {
                            boxes[boxIndex] = authUser.uid;
                            scores[authUser.uid]++;
                            boxesCompletedThisTurn++;
                        }
                    }
                }
                
                const partnerId = Object.keys(freshGame.players).find(id => id !== authUser.uid)!;
                let newTurn: string | null = (boxesCompletedThisTurn > 0) ? authUser.uid : partnerId;
                const totalBoxes = gridSize * gridSize;
                const currentTotalScore = Object.values(scores).reduce((a, b) => a + b, 0);

                let newStatus: 'active' | 'finished' | 'draw' = 'active';
                let newWinner: string | null = null;

                if (currentTotalScore === totalBoxes) {
                    if (scores[authUser.uid] > scores[partnerId]) {
                         newStatus = 'finished';
                         newWinner = authUser.uid;
                    } else if (scores[authUser.uid] < scores[partnerId]) {
                        newStatus = 'finished';
                        newWinner = partnerId;
                    } else {
                        newStatus = 'draw';
                    }
                    newTurn = null;
                }

                transaction.update(chatRef, {
                    'game.h_lines': h_lines,
                    'game.v_lines': v_lines,
                    'game.boxes': boxes,
                    'game.scores': scores,
                    'game.turn': newTurn,
                    'game.status': newStatus,
                    'game.winner': newWinner,
                });
            });
        } catch (e) {
            console.error("Dots and Boxes move failed:", e);
            toast({ variant: "destructive", title: "Error", description: "Could not make move." });
        }
    };


    const getStatusText = () => {
        if (game.status === 'pending') {
            if (game.initiatorId !== currentUserId) {
                return (
                    <div className="text-center space-y-2">
                        <p>Your opponent invited you to play Dots and Boxes!</p>
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
        
        if (isMyTurn) return "Your turn";
        return "Opponent's turn";
    };

    const myPlayerClass = game.players[currentUserId] === 'p1' ? 'bg-primary/50' : 'bg-accent/50';
    const partnerPlayerClass = game.players[partnerId] === 'p1' ? 'bg-primary/50' : 'bg-accent/50';
    
    return (
        <Card className="h-full flex flex-col border-0 rounded-none shadow-none bg-background">
        <CardHeader>
            <CardTitle>Dots and Boxes</CardTitle>
            <CardDescription className="min-h-[40px] flex flex-col items-center justify-center text-center">
                 <div className="flex gap-4 text-sm font-bold">
                    <span className={cn(game.players[currentUserId] === 'p1' ? "text-primary" : "text-accent")}>You: {game.scores[currentUserId]}</span>
                    <span className={cn(game.players[partnerId] === 'p1' ? "text-primary" : "text-accent")}>Opponent: {game.scores[partnerId]}</span>
                </div>
                {getStatusText()}
            </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-2">
            <div className="grid" style={{gridTemplateColumns: `repeat(${game.gridSize}, auto 1fr) auto`, gridTemplateRows: `repeat(${game.gridSize}, auto 1fr) auto`}}>
                {Array.from({length: game.gridSize * 2 + 1}).map((_, r) => (
                     Array.from({length: game.gridSize * 2 + 1}).map((_, c) => {
                        // Dot
                        if(r % 2 === 0 && c % 2 === 0) {
                            return <div key={`${r}-${c}`} className="w-4 h-4 bg-muted rounded-full"/>
                        }
                        // Horizontal Line
                        if(r % 2 === 0 && c % 2 !== 0) {
                           const lineIndex = (r/2) * game.gridSize + (c-1)/2;
                           const ownerId = game.h_lines[lineIndex];
                           const ownerClass = ownerId ? (game.players[ownerId] === 'p1' ? 'bg-primary' : 'bg-accent') : '';
                           return (
                             <button 
                                key={`${r}-${c}`}
                                onClick={() => handleLineClick('h', lineIndex)}
                                disabled={!!ownerId || !isMyTurn || game.status !== 'active'}
                                className={cn("h-4 mx-1 flex-1 bg-secondary hover:bg-primary/30 disabled:cursor-not-allowed rounded-sm", ownerClass)} 
                            />
                           )
                        }
                        // Vertical Line
                        if(r % 2 !== 0 && c % 2 === 0) {
                           const lineIndex = (r-1)/2 * (game.gridSize + 1) + c/2;
                           const ownerId = game.v_lines[lineIndex];
                            const ownerClass = ownerId ? (game.players[ownerId] === 'p1' ? 'bg-primary' : 'bg-accent') : '';
                           return (
                              <button 
                                key={`${r}-${c}`}
                                onClick={() => handleLineClick('v', lineIndex)}
                                disabled={!!ownerId || !isMyTurn || game.status !== 'active'}
                                className={cn("w-4 my-1 bg-secondary hover:bg-primary/30 disabled:cursor-not-allowed rounded-sm", ownerClass)}
                             />
                           )
                        }
                        // Box
                        if(r % 2 !== 0 && c % 2 !== 0) {
                            const boxIndex = (r-1)/2 * game.gridSize + (c-1)/2;
                            const ownerId = game.boxes[boxIndex];
                            const ownerClass = ownerId ? (game.players[ownerId] === 'p1' ? 'bg-primary/30' : 'bg-accent/30') : '';
                            return <div key={`${r}-${c}`} className={cn("flex-1", ownerClass)} />;
                        }
                        return null;
                     })
                ))}
            </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
            {game.status !== 'pending' && <Button variant="destructive" className="w-full" onClick={onQuitGame}>Quit Game</Button>}
        </CardFooter>
        </Card>
    );
}
