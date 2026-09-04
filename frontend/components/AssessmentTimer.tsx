'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Clock, AlertTriangle } from 'lucide-react';

interface AssessmentTimerProps {
  attemptId: string;
  initialRemainingSeconds?: number;
  onExpire?: () => void;
}

export default function AssessmentTimer({
  attemptId,
  initialRemainingSeconds = 3600,
  onExpire,
}: AssessmentTimerProps) {
  const [seconds, setSeconds] = useState(initialRemainingSeconds);
  const [isExpired, setIsExpired] = useState(false);

  // Poll server every 15 seconds to stay strictly in sync with server-side time
  useEffect(() => {
    let isMounted = true;

    const syncWithServer = async () => {
      try {
        const res = await api.getAttemptStatus(attemptId);
        if (isMounted) {
          setSeconds(res.remaining_seconds);
          if (res.remaining_seconds <= 0 || res.is_expired) {
            setIsExpired(true);
            if (onExpire) onExpire();
          }
        }
      } catch (err) {
        console.error('Error syncing timer with server:', err);
      }
    };

    syncWithServer();
    const serverSyncInterval = setInterval(syncWithServer, 15000);

    // Local 1-second interval ticker
    const localTickInterval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(serverSyncInterval);
      clearInterval(localTickInterval);
    };
  }, [attemptId, onExpire]);

  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;

  const isLowTime = seconds < 300 && seconds > 0;

  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold text-text-secondary tracking-widest uppercase mb-1">
        Time Remaining
      </span>
      <div className="flex items-center gap-3">
        <span
          className={`font-mono text-3xl md:text-4xl font-bold tracking-tight ${
            isExpired
              ? 'text-status-attention'
              : isLowTime
              ? 'text-status-needsReview animate-pulse'
              : 'text-accent'
          }`}
        >
          {formattedTime}
        </span>
        {isLowTime && (
          <span className="flex items-center gap-1 text-xs text-status-needsReview font-medium bg-status-needsReview/10 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>&lt; 5m left</span>
          </span>
        )}
        {isExpired && (
          <span className="flex items-center gap-1 text-xs text-status-attention font-medium bg-status-attention/10 px-2 py-0.5 rounded-full">
            <span>Time Expired</span>
          </span>
        )}
      </div>
    </div>
  );
}
