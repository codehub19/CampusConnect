
"use client";

import { useAuth } from '@/hooks/use-auth';
import type { GameState } from '@/lib/types';
import { doc, getFirestore, updateDoc, runTransaction } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import React, { useState, useEffect } from 'react';

interface ConnectFourProps {
    chatId: string;
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
}

export default function ConnectFour({ chatId, gameState: initialGameState, setGameState: setParentGameState }: ConnectFourProps) {
    const { user } = useAuth();
    const db = getFirestore(firebaseApp);
    const [isMakingMove, setIsMakingMove] = useState(false);
    
    // Use local state to manage game state to avoid props-based re-renders causing flickers
    const [gameState, setGameState] = useState(initialGameState);

    useEffect(() => {
        // If not currently making a move, update local state from parent
        // This allows updates from Firestore (like opponent's move) to come in
        if (!isMakingMove) {
            setGameState(initialGameState);
        }
    }, [initialGameState, isMakingMove]);
    
    // Sync local state back to the parent component for other parts of the UI
    useEffect(() => {
        setParentGameState(gameState);
    }, [gameState, setParentGameState]);


    const { status, players, turn, winner, board } = gameState;
    const myPlayerNumber = user ? players[user.uid] : null;
    const isMyTurn = turn === user?.uid;

    const handleMove = async (colIndex: number) => {
        if (!isMyTurn || status !== 'active' || isMakingMove) return;
        
        let landingRow = -1;
        const currentBoard = gameState.board;
        for (let r = 5; r >= 0; r--) {
            if (currentBoard[colIndex + r * 7] === null) {
                landingRow = r;
                break;
            }
        }
        if(landingRow === -1) return; // Column is full
        
        setIsMakingMove(true);
        const chatRef = doc(db, 'chats', chatId);
        const tempBoard = [...currentBoard];
        tempBoard[colIndex + landingRow * 7] = myPlayerNumber;
        setGameState(prev => ({...prev!, board: tempBoard, turn: null }));

        try {
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(chatRef);
                if (!docSnap.exists()) throw new Error("Chat does not exist!");
                const currentGame = docSnap.data().game as GameState;
                if(currentGame.turn !== user?.uid) throw new Error("Not your turn!");
                if(currentGame.board[colIndex + landingRow * 7] !== null) throw new Error("This cell is already taken!");

                const hasWon = checkWinner(tempBoard, myPlayerNumber);
                const isDraw = !hasWon && tempBoard.every(cell => cell !== null);
                const partnerId = Object.keys(players).find(id => id !== user?.uid);

                const newGameData: Partial<GameState> = {
                    board: tempBoard,
                    turn: hasWon || isDraw ? null : partnerId,
                    status: hasWon ? 'win' : isDraw ? 'draw' : 'active',
                    winner: hasWon ? user?.uid : null,
                };
                
                transaction.update(chatRef, { game: {...currentGame, ...newGameData} });
            });
        } catch (e: any) {
            console.error("Connect Four move failed: ", e);
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Could not make move.' });
            // Revert optimistic update on error
            setGameState(initialGameState);
        } finally {
            setIsMakingMove(false);
        }
    };
    
    const checkWinner = (board: any[], player: number | 'X' | 'O' | 'p1' | 'p2' | null) => {
        if (!player) return false;
        const C = 7, R = 6;
        for (let r = 0; r < R; r++) for (let c = 0; c < C - 3; c++) if (board[c+r*C]===player&&board[c+1+r*C]===player&&board[c+2+r*C]===player&&board[c+3+r*C]===player)return true;
        for (let c = 0; c < C; c++) for (let r = 0; r < R - 3; r++) if (board[c+r*C]===player&&board[c+(r+1)*C]===player&&board[c+(r+2)*C]===player&&board[c+(r+3)*C]===player)return true;
        for (let r = 0; r < R - 3; r++) for (let c = 0; c < C - 3; c++) if (board[c+r*C]===player&&board[c+1+(r+1)*C]===player&&board[c+2+(r+2)*C]===player&&board[c+3+(r+3)*C]===player)return true;
        for (let r = 3; r < R; r++) for (let c = 0; c < C - 3; c++) if (board[c+r*C]===player&&board[c+1+(r-1)*C]===player&&board[c+2+(r-2)*C]===player&&board[c+3+(r-3)*C]===player)return true;
        return false;
    };
    
     const handleQuit = async () => {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { game: null });
    };

    const getStatusText = () => {
        if (status === 'pending') return "Waiting for opponent...";
        if (status === 'active') return isMyTurn ? "Your turn" : "Opponent's turn";
        if (status === 'win') return winner === user?.uid ? "You win! 🎉" : "You lose. 😥";
        if (status === 'draw') return "It's a draw!";
        return "";
    };

    return (
        <div className="p-4 h-full flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-lg mb-2">Connect Four</h3>
            <div className="mb-4 h-6">{getStatusText()} {status === 'active' && isMyTurn && <div className={cn("inline-block w-4 h-4 rounded-full", myPlayerNumber === 1 ? 'bg-yellow-400' : 'bg-red-500')}></div>}</div>
            <div className="grid grid-cols-7 gap-1 bg-primary p-2 rounded-lg">
                {Array.from({ length: 7 }).map((_, c) => (
                    <div key={c} className="flex flex-col-reverse gap-1">
                        {Array.from({ length: 6 }).map((_, r) => {
                             const player = board[c + r * 7];
                             const isEmpty = player === null;
                             return (
                                <button 
                                    key={`${c}-${r}`} 
                                    className={cn("w-8 h-8 bg-background rounded-full flex items-center justify-center transition-transform", isEmpty && isMyTurn && status === 'active' && "cursor-pointer hover:bg-background/80 active:scale-90")}
                                    onClick={() => handleMove(c)}
                                    disabled={!isMyTurn || status !== 'active' || !isEmpty}
                                >
                                    {player === 1 && <div className="w-6 h-6 rounded-full bg-yellow-400"></div>}
                                    {player === 2 && <div className="w-6 h-6 rounded-full bg-red-500"></div>}
                                </button>
                             )
                        })}
                    </div>
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
    )
}
