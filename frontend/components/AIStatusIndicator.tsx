'use client';

import React from 'react';
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface AIStatusIndicatorProps {
  status: 'idle' | 'processing' | 'retrying' | 'complete' | 'error';
  message?: string;
}

export default function AIStatusIndicator({
  status,
  message,
}: AIStatusIndicatorProps) {
  if (status === 'idle') {
    return (
      <div className="bg-bg-surface-2 border border-border p-4 rounded-2xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-bg-surface flex items-center justify-center text-text-secondary">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-text-primary">EvalAssist AI Status</h4>
          <p className="text-xs text-text-secondary">{message || 'Waiting for submission...'}</p>
        </div>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="bg-bg-surface-2 border border-accent/40 p-4 rounded-2xl flex items-center gap-3 animate-pulse shadow-glow-accent">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-accent">AI Tutor Beta Evaluating...</h4>
          <p className="text-xs text-text-secondary">{message || 'Analyzing handwriting, OCR, and rubric alignment...'}</p>
        </div>
      </div>
    );
  }

  if (status === 'retrying') {
    return (
      <div className="bg-bg-surface-2 border border-status-needsReview/40 p-4 rounded-2xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-status-needsReview/20 flex items-center justify-center text-status-needsReview">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-status-needsReview">AI Tutor Still Working...</h4>
          <p className="text-xs text-text-secondary">High demand queue. Automatically retrying with exponential backoff...</p>
        </div>
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="bg-bg-surface-2 border border-status-highConfidence/40 p-4 rounded-2xl flex items-center gap-3 shadow-glow-green">
        <div className="w-8 h-8 rounded-lg bg-status-highConfidence/20 flex items-center justify-center text-status-highConfidence">
          <CheckCircle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-status-highConfidence">Evaluation Complete</h4>
          <p className="text-xs text-text-secondary">{message || 'Marks and detailed bounding boxes ready.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface-2 border border-status-attention/40 p-4 rounded-2xl flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-status-attention/20 flex items-center justify-center text-status-attention">
        <AlertCircle className="w-4 h-4" />
      </div>
      <div>
        <h4 className="text-xs font-semibold text-status-attention">Evaluation Alert</h4>
        <p className="text-xs text-text-secondary">{message || 'An issue occurred during evaluation.'}</p>
      </div>
    </div>
  );
}
