
"use client";

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { GameState } from '@/lib/types';
import { doc, getFirestore, runTransaction, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface TicTacToeProps {
    chatId: string;
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
}

export default function TicTacToe({ chatId, gameState, setGameState }: TicTacToeProps) {
    const { user } = useAuth();
    const db = getFirestore(firebaseApp);

    const { status, players, turn, winner, board } = gameState;
    const mySymbol = user ? players[user.uid] : null;
    const isMyTurn = turn === user?.uid;

    const handleMove = async (index: number) => {
        if (!isMyTurn || board[index] !== null || status !== 'active') return;
        
        const chatRef = doc(db, 'chats', chatId);
        const partnerId = Object.keys(players).find(id => id !== user?.uid);

        // Optimistic update
        const newBoard = [...board];
        newBoard[index] = mySymbol;

        const hasWon = checkWinner(newBoard, mySymbol);
        const isDraw = !hasWon && newBoard.every(cell => cell !== null);
        
        const newGameData: Partial<GameState> = {
            board: newBoard,
            turn: hasWon || isDraw ? null : partnerId,
            status: hasWon ? 'win' : isDraw ? 'draw' : 'active',
            winner: hasWon ? user?.uid : null,
        };

        setGameState(prev => prev ? ({ ...prev, ...newGameData }) : null);

        // Firestore transaction
        try {
            await runTransaction(db, async (transaction) => {
                const chatDoc = await transaction.get(chatRef);
                if (!chatDoc.exists()) throw "Chat does not exist!";
                
                const currentGame = chatDoc.data().game as GameState;
                if(currentGame.board[index] !== null || currentGame.turn !== user?.uid) {
                    // If server state is different, abort. The optimistic UI will be corrected by the snapshot listener.
                    return;
                };
                
                transaction.update(chatRef, { game: {...currentGame, ...newGameData} });
            });
        } catch (e) {
            console.error("Tic Tac Toe move failed: ", e);
            toast({ variant: 'destructive', title: 'Error making move' });
            // Revert on error
            setGameState(gameState);
        }
    };

    const checkWinner = (board: any[], player: any) => {
        const winConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6]             // diagonals
        ];
        return winConditions.some(combination => combination.every(index => board[index] === player));
    };
    
    const handleQuit = async () => {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { game: null });
    };

    const getStatusText = () => {
        switch (status) {
            case 'pending':
                return "Waiting for opponent to accept...";
            case 'active':
                return isMyTurn ? `Your turn (${mySymbol})` : "Opponent's turn";
            case 'win':
                return winner === user?.uid ? "You win! 🎉" : "You lose. 😥";
            case 'draw':
                return "It's a draw!";
            default:
                return "";
        }
    };

    return (
        <div className="p-4 h-full flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-lg mb-2">Tic-Tac-Toe</h3>
            <p className="mb-4 h-6">{getStatusText()}</p>
            <div className="grid grid-cols-3 gap-2 w-full max-w-[200px]">
                {board.map((cell, index) => (
                    <button
                        key={index}
                        onClick={() => handleMove(index)}
                        disabled={!isMyTurn || cell !== null || status !== 'active'}
                        className="aspect-square bg-secondary rounded-md flex items-center justify-center text-3xl font-bold disabled:cursor-not-allowed"
                    >
                        {cell === 'X' ? <span className="text-blue-400">X</span> : cell === 'O' ? <span className="text-yellow-400">O</span> : null}
                    </button>
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
