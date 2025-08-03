
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';

const INACTIVITY_TIMEOUT = 290 * 1000; // 4 minutes 50 seconds
const COUNTDOWN_DURATION = 10 * 1000; // 10 seconds

interface InactivityTimerProps {
  onIdle: () => void;
}

export default function InactivityTimer({ onIdle }: InactivityTimerProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION / 1000);
  
  const inactivityTimerRef = useRef<NodeJS.Timeout>();
  const countdownTimerRef = useRef<NodeJS.Timeout>();

  const resetTimers = () => {
    // Clear existing timers
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    // Hide warning and reset countdown
    setShowWarning(false);
    setCountdown(COUNTDOWN_DURATION / 1000);

    // Start the main inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, INACTIVITY_TIMEOUT);
  };

  const startCountdown = () => {
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current!);
          onIdle();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  // This effect will run when the component mounts and on every re-render caused by a key change (activity)
  useEffect(() => {
    resetTimers();
    return () => {
      clearTimeout(inactivityTimerRef.current);
      clearInterval(countdownTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!showWarning) {
    return null;
  }

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 w-1/2 max-w-sm p-2 bg-background/80 backdrop-blur-sm rounded-lg shadow-lg border text-center">
        <p className="text-xs text-muted-foreground mb-1">Chat ending due to inactivity in {countdown}s</p>
        <Progress value={(countdown / (COUNTDOWN_DURATION / 1000)) * 100} className="h-1" />
    </div>
  );
}
