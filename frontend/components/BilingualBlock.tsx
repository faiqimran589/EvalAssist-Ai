'use client';

import React from 'react';

interface BilingualBlockProps {
  englishText: string;
  urduText: string;
  className?: string;
  englishClassName?: string;
  urduClassName?: string;
}

export default function BilingualBlock({
  englishText,
  urduText,
  className = '',
  englishClassName = '',
  urduClassName = '',
}: BilingualBlockProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* English Text (LTR) */}
      <p className={`text-text-primary text-sm leading-relaxed ${englishClassName}`}>
        {englishText}
      </p>

      {/* Urdu Translation Stacked (RTL + Noto Nastaliq Urdu) */}
      {urduText && (
        <div
          dir="rtl"
          className={`urdu-text text-text-primary/95 text-base md:text-lg border-t border-border/40 pt-2 font-normal ${urduClassName}`}
        >
          {urduText}
        </div>
      )}
    </div>
  );
}
