"use client";

import React, { useState } from 'react';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TicTacToeProps {
  onOpenChange: (open: boolean) => void;
}

const calculateWinner = (squares: (string | null)[]) => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
};

const Square = ({ value, onSquareClick }: { value: string | null; onSquareClick: () => void }) => {
  return (
    <button
      className={cn(
        "h-20 w-20 md:h-24 md:w-24 bg-secondary flex items-center justify-center rounded-lg shadow-md transition-all duration-150 ease-out hover:scale-105",
        value === 'X' ? 'text-primary' : 'text-accent'
      )}
      onClick={onSquareClick}
    >
      {value && <span className="text-5xl font-bold">{value}</span>}
    </button>
  );
};

export default function TicTacToe({ onOpenChange }: TicTacToeProps) {
  const [squares, setSquares] = useState<(string | null)[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);

  const winner = calculateWinner(squares);
  const isBoardFull = squares.every(Boolean);
  
  let status;
  if (winner) {
    status = `Winner: ${winner}!`;
  } else if (isBoardFull) {
    status = "It's a draw!";
  } else {
    status = `Next player: ${xIsNext ? 'X' : 'O'}`;
  }

  const handleClick = (i: number) => {
    if (squares[i] || winner) {
      return;
    }
    const nextSquares = squares.slice();
    nextSquares[i] = xIsNext ? 'X' : 'O';
    setSquares(nextSquares);
    setXIsNext(!xIsNext);
  };
  
  const handleReset = () => {
    setSquares(Array(9).fill(null));
    setXIsNext(true);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Tic-Tac-Toe</DialogTitle>
        <DialogDescription>Challenge your friend to a game. May the best player win!</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col items-center justify-center p-4">
        <div className="text-lg font-medium mb-4">{status}</div>
        <div className="grid grid-cols-3 gap-2">
          {squares.map((square, i) => (
            <Square key={i} value={square} onSquareClick={() => handleClick(i)} />
          ))}
        </div>
      </div>
       <DialogFooter className="mt-4">
        <Button variant="outline" onClick={handleReset}>Reset Game</Button>
        <Button onClick={() => onOpenChange(false)}>Close</Button>
      </DialogFooter>
    </DialogContent>
  );
}
