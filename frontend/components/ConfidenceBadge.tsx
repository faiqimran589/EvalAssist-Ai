'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfidenceBadgeProps {
  status?: string;
  confidenceScore?: number;
  scorePct?: number;
  label?: string;
}

export default function ConfidenceBadge({
  status,
  confidenceScore,
  scorePct,
  label,
}: ConfidenceBadgeProps) {
  // If explicitly under teacher review or status is not published
  if (status === 'needs_review' || status === 'under_review' || label === 'Under Teacher Review') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-status-needsReview/10 border border-status-needsReview/30 text-status-needsReview rounded-full text-xs font-semibold">
        <Clock className="w-3.5 h-3.5" />
        <span>Under Teacher Review</span>
      </span>
    );
  }

  // Derive score percentage
  const effectivePct = scorePct !== undefined
    ? scorePct
    : (confidenceScore !== undefined ? Math.round(confidenceScore > 1 ? confidenceScore : confidenceScore * 100) : 80);

  if (effectivePct >= 80 || label === 'High Confidence') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-status-highConfidence/10 border border-status-highConfidence/30 text-status-highConfidence rounded-full text-xs font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>High Confidence ({effectivePct}%)</span>
      </span>
    );
  }

  if (effectivePct >= 60 || label === 'Moderate Confidence') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 border border-accent/30 text-accent rounded-full text-xs font-semibold">
        <HelpCircle className="w-3.5 h-3.5" />
        <span>Moderate Confidence ({effectivePct}%)</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-status-attention/10 border border-status-attention/30 text-status-attention rounded-full text-xs font-semibold">
      <AlertTriangle className="w-3.5 h-3.5" />
      <span>Low Confidence ({effectivePct}%)</span>
    </span>
  );
}
