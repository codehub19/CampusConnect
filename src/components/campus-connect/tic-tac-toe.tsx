
"use client";

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { GameState } from '@/lib/types';
import { doc, getFirestore, updateDoc, runTransaction } from 'firebase/firestore';
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
        const newBoard = [...board];
        newBoard[index] = mySymbol;
        setGameState(prev => ({...prev!, board: newBoard, turn: null}));

        try {
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(chatRef);
                if (!docSnap.exists()) throw new Error("Chat does not exist!");
                const currentGame = docSnap.data().game as GameState;
                if(currentGame.turn !== user?.uid) throw new Error("Not your turn!");
                if(currentGame.board[index] !== null) throw new Error("This cell is already taken!");

                const hasWon = checkWinner(newBoard, mySymbol);
                const isDraw = !hasWon && newBoard.every(cell => cell !== null);
                const partnerId = Object.keys(players).find(id => id !== user?.uid);
                
                const newGameData: Partial<GameState> = {
                    board: newBoard,
                    turn: hasWon || isDraw ? null : partnerId,
                    status: hasWon ? 'win' : isDraw ? 'draw' : 'active',
                    winner: hasWon ? user?.uid : null,
                };
                
                transaction.update(chatRef, { game: {...currentGame, ...newGameData} });
            });
        } catch (e: any) {
            console.error("Tic Tac Toe move failed: ", e);
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Could not make move.' });
        }
    };

    const checkWinner = (board: any[], player: any) => {
        if (!player) return false;
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

    