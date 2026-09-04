/**
 * Math text utilities: segment mixed prose/LaTeX strings and render the math
 * segments to KaTeX HTML.
 *
 * Convention (enforced in the backend prompts): mathematical expressions are
 * enclosed in single dollar-sign delimiters, e.g.
 *   "Solve $\\frac{x}{2} + \\sqrt{3} = 5$ for $x$."
 * Everything outside $...$ is plain prose (Urdu or English).
 */

import katex from 'katex';

export interface TextSegment {
  kind: 'text' | 'math';
  /** Raw content: prose for 'text', LaTeX source for 'math'. */
  content: string;
}

/**
 * Splits a string into prose and $...$ math segments.
 * Escaped dollars (\$) are treated as literal characters. An unterminated
 * dollar sign never swallows the rest of the string — the tail is emitted
 * as prose.
 */
export function segmentMathText(input: string): TextSegment[] {
  if (!input) return [];

  const segments: TextSegment[] = [];
  let prose = '';
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Escaped dollar → literal '$' in prose
    if (ch === '\\' && input[i + 1] === '$') {
      prose += '$';
      i += 2;
      continue;
    }

    if (ch === '$') {
      // Find the closing delimiter (not an escaped \$)
      let j = i + 1;
      let math = '';
      while (j < input.length) {
        if (input[j] === '\\' && input[j + 1] === '$') {
          math += '$';
          j += 2;
          continue;
        }
        if (input[j] === '$') break;
        math += input[j];
        j += 1;
      }

      if (j < input.length && math.trim()) {
        // Well-formed $...$ block found
        if (prose) {
          segments.push({ kind: 'text', content: prose });
          prose = '';
        }
        segments.push({ kind: 'math', content: math.trim() });
        i = j + 1;
        continue;
      }
      // No closing delimiter (or empty math) → treat '$' as literal prose
      prose += '$';
      i += 1;
      continue;
    }

    prose += ch;
    i += 1;
  }

  if (prose) segments.push({ kind: 'text', content: prose });
  return segments;
}

/** True when the string contains at least one $...$ math segment. */
export function containsMath(input: string): boolean {
  return segmentMathText(input).some((s) => s.kind === 'math');
}

/**
 * Renders a LaTeX source string to KaTeX HTML. Returns null when KaTeX
 * cannot parse the expression so callers can fall back to plain text.
 */
export function renderMathToHtml(latex: string, displayMode: boolean = false): string | null {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      strict: 'ignore',
      trust: false,
    });
  } catch {
    return null;
  }
}
