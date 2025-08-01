
"use client";

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
}

export default function DotsAndBoxes({ chatId, gameState }: DotsAndBoxesProps) {
    const { user } = useAuth();
    const db = getFirestore(firebaseApp);
    const { status, initiatorId, players, turn, scores, gridSize, h_lines, v_lines, boxes } = gameState;

    const myPlayerId = user ? players[user.uid] as string : null;
    const isMyTurn = turn === user?.uid;
    
    const handleAccept = async () => {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { 'game.status': 'active', 'game.turn': initiatorId });
    }

    const handleDecline = async () => {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { game: null });
        toast({ title: 'Game declined' });
    }

    const handleMove = async (type: 'h' | 'v', index: number) => {
        if (!isMyTurn || status !== 'active') return;
        const chatRef = doc(db, 'chats', chatId);
        
        try {
            await runTransaction(db, async (transaction) => {
                const chatDoc = await transaction.get(chatRef);
                if (!chatDoc.exists()) throw "Chat does not exist!";
                const game = chatDoc.data().game as GameState;
                if(game.turn !== user?.uid) return;

                const new_h_lines = [...game.h_lines];
                const new_v_lines = [...game.v_lines];
                const new_boxes = [...game.boxes];
                const new_scores = {...game.scores};

                if ((type === 'h' && new_h_lines[index]) || (type === 'v' && new_v_lines[index])) return;
                
                if (type === 'h') new_h_lines[index] = user.uid;
                else new_v_lines[index] = user.uid;
                
                let boxesCompleted = 0;
                 for (let r = 0; r < game.gridSize; r++) {
                    for (let c = 0; c < game.gridSize; c++) {
                        const boxIndex = r * game.gridSize + c;
                        if (!new_boxes[boxIndex] && 
                            new_h_lines[r * game.gridSize + c] &&
                            new_h_lines[(r + 1) * game.gridSize + c] &&
                            new_v_lines[r * (game.gridSize + 1) + c] &&
                            new_v_lines[r * (game.gridSize + 1) + (c + 1)]
                        ) {
                            new_boxes[boxIndex] = user.uid;
                            new_scores[user.uid]++;
                            boxesCompleted++;
                        }
                    }
                }
                
                const partnerId = Object.keys(players).find(id => id !== user.uid);
                let newTurn = (boxesCompleted > 0) ? user.uid : partnerId!;
                
                let newStatus: GameState['status'] = 'active';
                if(Object.values(new_scores).reduce((a,b) => a+b, 0) === game.gridSize * game.gridSize){
                    newStatus = new_scores[user.uid] === new_scores[partnerId!] ? 'draw' : 'win';
                    newTurn = null;
                }

                transaction.update(chatRef, {
                    'game.h_lines': new_h_lines,
                    'game.v_lines': new_v_lines,
                    'game.boxes': new_boxes,
                    'game.scores': new_scores,
                    'game.turn': newTurn,
                    'game.status': newStatus,
                });
            });
        } catch (e) {
             console.error("Dots and Boxes move failed: ", e);
             toast({ variant: 'destructive', title: 'Error making move' });
        }
    };
    
    const getStatusText = () => {
        if (status === 'pending') return initiatorId === user?.uid ? "Waiting for opponent..." : "invites you to play!";
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

    if (status === 'pending' && initiatorId !== user?.uid) {
        return (
            <div className="p-4 h-full flex flex-col items-center justify-center text-center">
                <p className="font-semibold mb-4">Your opponent wants to play Dots & Boxes!</p>
                <div className="flex gap-2">
                    <Button onClick={handleAccept}>Accept</Button>
                    <Button variant="destructive" onClick={handleDecline}>Decline</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 h-full flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-lg mb-2">Dots & Boxes</h3>
             <div className="text-center text-sm">
                <p><span className={cn(players[user!.uid] === 'p1' ? "text-yellow-400" : "text-red-400")}>You: {scores[user!.uid]}</span> | <span>Opponent: {scores[Object.keys(scores).find(id => id !== user!.uid)!]}</span></p>
                <p className="mt-1 h-5">{getStatusText()}</p>
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
                                disabled={!isMyTurn || !!h_lines[r * gridSize + c]}
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
                                disabled={!isMyTurn || !!v_lines[r * (gridSize + 1) + c]}
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
                 <Button onClick={handleQuit} variant="secondary" className="mt-4">Back to Game Center</Button>
            ) : (
                 <Button onClick={handleQuit} variant="destructive" className="mt-4">Quit Game</Button>
            )}
        </div>
    );
}
