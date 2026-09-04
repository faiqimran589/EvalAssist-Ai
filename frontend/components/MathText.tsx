'use client';

import React, { useMemo } from 'react';
import { segmentMathText, renderMathToHtml } from '@/lib/mathText';

interface MathTextProps {
  /** Raw text possibly containing $...$ LaTeX segments. */
  children?: string | null;
  className?: string;
  /** KaTeX display mode (centered block) for math segments. */
  displayMode?: boolean;
  /** When false, renders plain text without math parsing. */
  enabled?: boolean;
}

/**
 * Renders mixed prose + $LaTeX$ strings. Math segments are typeset with
 * KaTeX (via dangerouslySetInnerHTML of katex.renderToString); prose is
 * rendered verbatim so Urdu RTL text keeps its natural direction.
 * If KaTeX cannot parse a segment, the raw source is shown as plain text —
 * rendering must never throw.
 */
export default function MathText({
  children,
  className = '',
  displayMode = false,
  enabled = true,
}: MathTextProps) {
  const raw = children ?? '';

  const segments = useMemo(
    () => (enabled ? segmentMathText(raw) : [{ kind: 'text' as const, content: raw }]),
    [raw, enabled]
  );

  const rendered = useMemo(
    () =>
      segments.map((seg, idx) => {
        if (seg.kind === 'text') {
          return <span key={idx}>{seg.content}</span>;
        }
        const html = renderMathToHtml(seg.content, displayMode);
        if (html === null) {
          // Unparseable LaTeX — fall back to raw source, never crash the page.
          return <span key={idx}>{`$${seg.content}$`}</span>;
        }
        // SAFETY: html comes exclusively from katex.renderToString() — a
        // typesetting engine that emits only <span>/<math> markup and never
        // scripts or event handlers. renderMathToHtml() hard-disables the
        // trust flag, so untrusted LaTeX commands like \href/\url that could
        // inject attributes are rejected by KaTeX itself. The user-controlled
        // LaTeX source is escaped by KaTeX during rendering.
        return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
      }),
    [segments, displayMode]
  );

  if (!raw) return null;

  return <span className={className}>{rendered}</span>;
}
