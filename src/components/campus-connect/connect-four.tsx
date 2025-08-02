
"use client";

import { useAuth } from '@/hooks/use-auth';
import type { GameState } from '@/lib/types';
import { doc, getFirestore, runTransaction, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ConnectFourProps {
    chatId: string;
    gameState: GameState;
}

export default function ConnectFour({ chatId, gameState }: ConnectFourProps) {
    const { user } = useAuth();
    const db = getFirestore(firebaseApp);

    const { status, players, turn, winner, board } = gameState;
    const myPlayerNumber = user ? players[user.uid] : null;
    const isMyTurn = turn === user?.uid;

    const handleMove = async (colIndex: number) => {
        if (!isMyTurn || status !== 'active') return;
        const chatRef = doc(db, 'chats', chatId);

        try {
            await runTransaction(db, async (transaction) => {
                const chatDoc = await transaction.get(chatRef);
                if (!chatDoc.exists()) throw "Chat does not exist!";
                
                const game = chatDoc.data().game as GameState;
                if (game.turn !== user?.uid || game.status !== 'active') return;

                let landingRow = -1;
                for (let r = 5; r >= 0; r--) {
                    if (game.board[colIndex + r * 7] === null) {
                        landingRow = r;
                        break;
                    }
                }

                if (landingRow === -1) return; // Column is full

                const newBoard = [...game.board];
                newBoard[colIndex + landingRow * 7] = myPlayerNumber;
                
                const hasWon = checkWinner(newBoard, myPlayerNumber as number);
                const isDraw = !hasWon && newBoard.every(cell => cell !== null);
                
                const partnerId = Object.keys(players).find(id => id !== user?.uid);

                const newGameData: Partial<GameState> = {
                    board: newBoard,
                    turn: hasWon || isDraw ? null : partnerId,
                    status: hasWon ? 'win' : isDraw ? 'draw' : 'active',
                    winner: hasWon ? user?.uid : null,
                };
                
                transaction.update(chatRef, { game: {...game, ...newGameData} });
            });
        } catch (e) {
            console.error("Connect Four move failed: ", e);
            toast({ variant: 'destructive', title: 'Error making move' });
        }
    };
    
    const checkWinner = (board: any[], player: number) => {
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
                    <div key={c} className="flex flex-col-reverse gap-1" onClick={() => handleMove(c)}>
                        {Array.from({ length: 6 }).map((_, r) => {
                             const player = board[c + r * 7];
                             return (
                                <div key={`${c}-${r}`} className="w-8 h-8 bg-background rounded-full flex items-center justify-center">
                                    {player === 1 && <div className="w-6 h-6 rounded-full bg-yellow-400"></div>}
                                    {player === 2 && <div className="w-6 h-6 rounded-full bg-red-500"></div>}
                                </div>
                             )
                        })}
                    </div>
                ))}
            </div>
             {(status === 'win' || status === 'draw') ? (
                 <Button onClick={() => {
                     const gameCenter = document.querySelector<HTMLDivElement>('#game-center-modal');
                     if(gameCenter) gameCenter.classList.remove('hidden');
                 }} variant="secondary" className="mt-4">Play Another Game</Button>
            ) : (
                 <Button onClick={handleQuit} variant="destructive" className="mt-4">Quit Game</Button>
            )}
        </div>
    )
}
