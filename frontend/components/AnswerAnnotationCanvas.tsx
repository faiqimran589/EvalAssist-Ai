'use client';

import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  XCircle,
  MessageSquareText,
  Layers,
} from 'lucide-react';
import { getUploadFileUrl } from '@/lib/api';
import MathText from '@/components/MathText';

/**
 * AI examiner annotation overlaying a student's handwritten answer sheet.
 * The vision grading engine returns normalized spatial coordinates in
 * [ymin, xmin, ymax, xmax] form (0-100 relative to the answer image);
 * these are converted into percentage bounds so boxes track the image at
 * any zoom level.
 */
export interface AnswerAnnotation {
  /** Normalized [ymin, xmin, ymax, xmax], 0-100 scale. */
  bbox: number[];
  label: string;
  /** 'positive' = marks awarded (green), 'issue' = marks deducted (red). */
  type: 'positive' | 'issue' | string;
  /** Marks delta for this annotation (e.g. +1.0 / -1.0). */
  marks?: number | null;
  /** Examiner comment, e.g. "+1 Mark: Correct application of formula". */
  comment?: string;
}

interface AnswerAnnotationCanvasProps {
  imageSrc: string;
  annotations?: AnswerAnnotation[];
  title?: string;
}

/**
 * Converts a grading-engine bbox to CSS percentage bounds.
 * Primary format: normalized [ymin, xmin, ymax, xmax] on a 0-100 scale
 * (the current vision grading schema). Legacy rows stored [x, y, w, h]
 * percentages and are converted to edges as a fallback.
 */
function toPercentBounds(bbox: number[] | undefined): { left: string; top: string; width: string; height: string } | null {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null;
  const vals = bbox.map(Number);
  if (vals.some((v) => Number.isNaN(v))) return null;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));

  // Primary: [ymin, xmin, ymax, xmax] — needs a positive-area box.
  const [ymin, xmin, ymax, xmax] = vals;
  if (ymax > ymin && xmax > xmin) {
    const top = clamp(ymin);
    const left = clamp(xmin);
    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${clamp(xmax) - left}%`,
      height: `${clamp(ymax) - top}%`,
    };
  }

  // Legacy fallback: [x, y, w, h] percentage extents.
  const [x, y, w, h] = vals;
  if (w > 0 && h > 0 && x + w <= 105 && y + h <= 105) {
    const left = clamp(x);
    const top = clamp(y);
    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${Math.min(w, 100 - left)}%`,
      height: `${Math.min(h, 100 - top)}%`,
    };
  }

  return null;
}

function formatMarksBadge(marks?: number | null): string | null {
  if (marks === null || marks === undefined || Number.isNaN(Number(marks))) return null;
  const m = Number(marks);
  if (m === 0) return null;
  return m > 0 ? `+${m} Mark${m !== 1 ? 's' : ''}` : `${m} Mark${m !== -1 ? 's' : ''}`;
}

export default function AnswerAnnotationCanvas({
  imageSrc,
  annotations = [],
  title = 'Student Answer Sheet — AI Evaluation Overlay',
}: AnswerAnnotationCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);

  const normalizedSrc = getUploadFileUrl(imageSrc);
  const positiveCount = annotations.filter((a) => a.type === 'positive').length;
  const issueCount = annotations.length - positiveCount;

  return (
    <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden flex flex-col">
      {/* Controls bar */}
      <div className="bg-bg-surface-2/80 px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-accent">
            <Layers className="w-4 h-4" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">{title}</h3>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono font-semibold">
            <span className="flex items-center gap-1 text-status-highConfidence">
              <CheckCircle2 className="w-3 h-3" /> {positiveCount} awarded
            </span>
            <span className="flex items-center gap-1 text-status-attention">
              <XCircle className="w-3 h-3" /> {issueCount} deducted
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.25))}
            title="Zoom Out"
            className="p-1.5 rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-text-secondary px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((prev) => Math.min(2.5, prev + 0.25))}
            title="Zoom In"
            className="p-1.5 rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            title="Reset Fit"
            className="p-1.5 rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={showOverlay}
            onClick={() => setShowOverlay(!showOverlay)}
            className={`ml-2 w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              showOverlay ? 'bg-accent' : 'bg-bg-base border border-border'
            }`}
            title="Toggle AI highlight overlay"
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                showOverlay ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Viewport: image + overlay boxes */}
      <div className="relative flex-1 min-h-[480px] bg-bg-base overflow-auto flex items-center justify-center p-6 select-none">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="relative inline-block transition-transform duration-150 ease-out"
        >
          <img
            src={normalizedSrc}
            alt={title}
            className="rounded-xl max-h-[640px] w-auto shadow-2xl object-contain border border-border/50"
          />

          {showOverlay &&
            annotations.map((ann, idx) => {
              const bounds = toPercentBounds(ann.bbox);
              if (!bounds) return null;
              const isPositive = ann.type === 'positive';
              const badge = formatMarksBadge(ann.marks);

              return (
                <div
                  key={idx}
                  style={bounds}
                  className={`absolute rounded-lg border-2 transition-all group cursor-help ${
                    isPositive
                      ? 'border-green-500 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                      : 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  }`}
                >
                  {/* Examiner tag: label + marks delta */}
                  <div
                    className={`absolute -top-7 left-0 px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-md whitespace-nowrap ${
                      isPositive ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}
                  >
                    {isPositive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    <span>{ann.label || (isPositive ? 'Correct' : 'Error')}</span>
                    {badge && <span className="font-mono">({badge})</span>}
                  </div>

                  {/* Examiner comment popover on hover */}
                  {ann.comment && (
                    <div className="absolute left-0 top-full mt-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div
                        className={`max-w-[280px] px-3.5 py-2.5 rounded-xl text-[11px] leading-relaxed shadow-lg border flex items-start gap-2 ${
                          isPositive
                            ? 'bg-green-950 border-green-600 text-green-100'
                            : 'bg-red-950 border-red-600 text-red-100'
                        }`}
                      >
                        <MessageSquareText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-70" />
                        <MathText className="[&_span]:whitespace-pre-wrap">{ann.comment}</MathText>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {annotations.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="px-4 py-2 rounded-xl bg-bg-surface/90 border border-border text-xs text-text-secondary font-medium">
              No AI annotations were produced for this answer sheet.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
