'use client';

import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Sparkles, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { getUploadFileUrl } from '@/lib/api';

export interface Annotation {
  bbox: number[]; // [x, y, w, h] percentage
  label: string;
  type: 'positive' | 'issue' | string;
  comment?: string; // Granular feedback comment attached to this bounding box
}

interface AnnotatedImageViewerProps {
  imageSrc: string;
  annotations?: Annotation[];
  title?: string;
}

export default function AnnotatedImageViewer({
  imageSrc,
  annotations = [],
  title = 'Student Submission',
}: AnnotatedImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);

  // Normalize path if pointing to /uploads
  const normalizedSrc = getUploadFileUrl(imageSrc);

  const handleZoomIn = () => setZoom((prev) => Math.min(2.5, prev + 0.25));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.5, prev - 0.25));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden flex flex-col h-full">
      {/* Top Controls Bar */}
      <div className="bg-bg-surface-2/80 px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1.5 rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-text-secondary px-1">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1.5 rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            title="Reset Fit"
            className="p-1.5 rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Overlay AI Highlights Switch */}
        <div className="flex items-center gap-2.5">
          <label htmlFor="overlay-toggle" className="text-xs font-medium text-text-secondary cursor-pointer select-none">
            {showOverlay ? 'Overlay AI Highlights (On)' : 'Original Image Only'}
          </label>
          <button
            id="overlay-toggle"
            type="button"
            role="switch"
            aria-checked={showOverlay}
            onClick={() => setShowOverlay(!showOverlay)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              showOverlay ? 'bg-accent' : 'bg-bg-base border border-border'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                showOverlay ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[480px] bg-bg-base overflow-auto flex items-center justify-center p-6 select-none">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="relative max-w-full transition-transform duration-150 ease-out"
        >
          {/* Main Image */}
          <img
            src={normalizedSrc}
            alt={title}
            className="rounded-xl max-h-[640px] w-auto shadow-2xl object-contain border border-border/50"
          />

          {/* Bounding Box Highlights */}
          {showOverlay &&
            annotations.map((ann, idx) => {
              const [x, y, w, h] = ann.bbox || [20, 20, 30, 10];
              const isPositive = ann.type === 'positive';
          
              return (
                <div
                  key={idx}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: `${w}%`,
                    height: `${h}%`,
                  }}
                  className={`absolute rounded-xl border-2 transition-all group cursor-pointer ${
                    isPositive
                      ? 'border-green-500 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                      : 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  }`}
                >
                  {/* Floating Tag label */}
                  <div
                    className={`absolute -top-7 left-0 px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-md whitespace-nowrap ${
                      isPositive
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {isPositive ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    <span>{ann.label}</span>
                  </div>
          
                  {/* Granular Feedback Comment Tooltip (shown on hover) */}
                  {ann.comment && (
                    <div className="absolute left-0 -bottom-1 translate-y-full z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className={`max-w-[240px] px-3 py-2 rounded-xl text-[11px] leading-relaxed shadow-lg border ${
                        isPositive
                          ? 'bg-green-950 border-green-600 text-green-200'
                          : 'bg-red-950 border-red-600 text-red-200'
                      }`}>
                        {ann.comment}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
