'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import AssessmentTimer from '@/components/AssessmentTimer';
import AIStatusIndicator from '@/components/AIStatusIndicator';
import { api, getUploadFileUrl } from '@/lib/api';
import { compressImageForUpload } from '@/lib/imageCompression';
import MathText from '@/components/MathText';
import { segmentMathText, renderMathToHtml, containsMath } from '@/lib/mathText';
import {
  ShieldCheck,
  Download,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Sparkles,
  ArrowRight
} from 'lucide-react';

// ===== Cambridge-style PDF export helpers =====

/** Escapes text for safe embedding inside html2canvas source HTML. */
const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Detects Urdu/Arabic script so the PDF pipeline can switch to RTL rendering. */
const containsUrdu = (text: string): boolean => {
  if (!text) return false;
  // Arabic/Urdu Unicode range: \u0600-\u06FF, \u0750-\u077F, \uFB50-\uFDFF, \uFE70-\uFEFF
  const urduRegex = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return urduRegex.test(text);
};

/** Formats minutes as Cambridge-style "1 hour 30 minutes". */
const formatDuration = (mins: number): string => {
  const m = Math.max(1, mins || 60);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${m} minute${m === 1 ? '' : 's'}`;
  if (rem === 0) return h === 1 ? '1 hour' : `${h} hours`;
  return `${h} hour${h > 1 ? 's' : ''} ${rem} minute${rem === 1 ? '' : 's'}`;
};

/** Deterministic short paper code derived from the assessment id (e.g. "EVA/204"). */
const derivePaperCode = (assessmentId: string): string => {
  const digits = (assessmentId || '').replace(/\D/g, '');
  return `EVA/${digits.slice(-3).padStart(3, '0') || '001'}`;
};

/**
 * Renders an HTML fragment to a canvas via html2canvas for embedding in jsPDF.
 * All sizing is expressed in PDF points and converted to CSS pixels (1pt = 0.75px),
 * so the rasterised image maps 1:1 onto the PDF page with no stretching.
 */
const renderHtmlToCanvas = async (
  html: string,
  cssText: string,
  widthPt: number
): Promise<HTMLCanvasElement | null> => {
  const div = document.createElement('div');
  div.style.cssText = cssText;
  div.style.width = `${widthPt / 0.75}px`;
  div.innerHTML = html;
  document.body.appendChild(div);

  try {
    // Force layout so referenced web fonts (KaTeX, Nastaliq) begin loading,
    // then wait for them so html2canvas snapshots fully typeset text.
    void div.offsetHeight;
    await document.fonts.load('12px KaTeX_Main');
    await document.fonts.load('italic 12px KaTeX_Math');
    await document.fonts.load('12px KaTeX_Size1');
    await document.fonts.load('12px KaTeX_Size2');
    await document.fonts.ready;
    const html2canvas = (await import('html2canvas')).default;
    return await html2canvas(div, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
    });
  } catch (err) {
    console.error('html2canvas error:', err);
    return null;
  } finally {
    document.body.removeChild(div);
  }
};

/** Urdu/RTL text → canvas (Nastaliq shaping is impossible with jsPDF core fonts). */
const renderTextToImage = async (
  text: string,
  widthPt: number,
  fontPt: number = 10,
  isRTL: boolean = false
): Promise<HTMLCanvasElement | null> => {
  if (!text) return null;
  return renderHtmlToCanvas(
    escapeHtml(text),
    `
      position: absolute;
      left: -9999px;
      top: -9999px;
      padding: 0;
      font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Arial Unicode MS', Arial, sans-serif;
      font-size: ${fontPt / 0.75}px;
      line-height: 1.8;
      color: #1a1a1a;
      background: white;
      direction: ${isRTL ? 'rtl' : 'ltr'};
      text-align: ${isRTL ? 'right' : 'left'};
      white-space: pre-wrap;
      word-wrap: break-word;
    `,
    widthPt
  );
};

/**
 * Mixed prose + $LaTeX$ text → canvas. Math segments are typeset with KaTeX
 * (trust disabled) and prose keeps a serif exam look, so the exported paper
 * shows real typeset fractions, roots and exponents instead of raw "\frac{a}{b}".
 */
const renderMathTextToImage = async (
  text: string,
  widthPt: number,
  fontPt: number = 10
): Promise<HTMLCanvasElement | null> => {
  if (!text) return null;

  const parts: string[] = [];
  for (const seg of segmentMathText(text)) {
    if (seg.kind === 'math') {
      const mathHtml = renderMathToHtml(seg.content, false);
      // Unparseable LaTeX falls back to the raw source between $ delimiters
      parts.push(mathHtml ?? escapeHtml(`$${seg.content}$`));
    } else {
      parts.push(escapeHtml(seg.content));
    }
  }

  return renderHtmlToCanvas(
    parts.join(''),
    `
      position: absolute;
      left: -9999px;
      top: -9999px;
      padding: 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: ${fontPt / 0.75}px;
      line-height: 1.6;
      color: #111111;
      background: white;
      white-space: pre-wrap;
      word-wrap: break-word;
    `,
    widthPt
  );
};

export default function TakeAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;

  const [attemptData, setAttemptData] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [aiMessage, setAiMessage] = useState('Waiting for submission...');
  const [isTimeExpired, setIsTimeExpired] = useState(false);

  // Initialize session
  useEffect(() => {
    if (!assessmentId) return;

    const initSession = async () => {
      try {
        const [attRes, assessRes] = await Promise.all([
          api.startAttempt(assessmentId),
          api.getAssessment(assessmentId),
        ]);
        setAttemptData(attRes);
        setAssessment(assessRes);
        if (attRes.remaining_seconds <= 0 || attRes.status === 'expired') {
          setIsTimeExpired(true);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to start assessment session.');
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [assessmentId]);

  // Security: Log blur & visibilitychange events
  useEffect(() => {
    if (!attemptData?.attempt_id) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        api.logBlurEvent(attemptData.attempt_id, 'User switched tab / minimized window.');
      }
    };

    const handleWindowBlur = () => {
      api.logBlurEvent(attemptData.attempt_id, 'Window lost focus.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [attemptData?.attempt_id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        alert('File size exceeds 15MB limit.');
        return;
      }
      // Compress in-browser before upload: 1200px max side, JPEG q0.75,
      // target <500KB — cuts payload transmission from ~40s to <2s.
      // PDFs pass through untouched; compression failure falls back to original.
      const uploadFile = await compressImageForUpload(file);
      setSelectedFile(uploadFile);
    }
    e.target.value = '';
  };

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const hasTypedAnswers = Object.values(answers).some((val) => val && val.trim().length > 0);
  const canSubmit = !submitting && !isTimeExpired && (Boolean(selectedFile) || hasTypedAnswers);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFile && !hasTypedAnswers) {
      alert('Please write your answers in the question answer boxes below or upload an answer sheet file.');
      return;
    }
    if (isTimeExpired) {
      alert('Time has expired for this assessment.');
      return;
    }

    setSubmitting(true);
    setAiStatus('processing');
    setAiMessage('Submitting work & executing automated AI Tutor evaluation...');

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      formData.append('answers_json', JSON.stringify(answers));

      const res = await api.submitAttempt(attemptData.attempt_id, formData);
      setAiStatus('complete');
      setAiMessage('Evaluation complete! Redirecting to your detailed results...');

      setTimeout(() => {
        router.push(`/student/submissions/${res.submission_id}`);
      }, 1200);
    } catch (err: any) {
      setAiStatus('error');
      setAiMessage(err.message || 'Submission failed.');
      setSubmitting(false);
    }
  };

  const handleDownloadTestPaper = async () => {
    if (!assessment) return;
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 48;
      const contentWidth = pageWidth - margin * 2;
      const bottomLimit = pageHeight - 64; // keep content clear of the footer band
      const indent = 24;                   // question text column indent
      const markCol = 36;                  // reserved right column for [n] allocations
      const textWidth = contentWidth - indent - markCol;
      let y = margin;

      const newPage = () => {
        doc.addPage();
        y = margin;
      };
      const ensureSpace = (needed: number) => {
        if (y + needed > bottomLimit) newPage();
      };

      // ---------- 1. Header block (bordered box, Cambridge style) ----------
      const subject = (assessment.subject || 'General').toUpperCase();
      const durationStr = formatDuration(assessment.duration_minutes || 60);
      const totalMarks = assessment.total_marks || 0;
      const paperCode = derivePaperCode(assessmentId);
      const session = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' });

      const headerTop = y;
      const labelX = margin + 16;
      const colMid = margin + contentWidth / 2;
      const colEnd = margin + contentWidth - 16;
      const halfEnd = colMid - 14;
      let hy = headerTop + 24;

      // Institution + board
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text('EVALASSIST AI', pageWidth / 2, hy, { align: 'center' });
      hy += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      doc.text('EXAMINATION BOARD', pageWidth / 2, hy, { align: 'center' });
      hy += 24;

      // Subject title + paper title + paper code
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text(subject, pageWidth / 2, hy, { align: 'center' });
      hy += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(70, 70, 70);
      const titleLines = doc
        .splitTextToSize(assessment.title || 'Assessment Paper', contentWidth - 32)
        .slice(0, 2);
      for (const tl of titleLines) {
        doc.text(tl, pageWidth / 2, hy, { align: 'center' });
        hy += 12;
      }
      doc.text(`${paperCode}  ·  ${session}`, pageWidth / 2, hy, { align: 'center' });
      hy += 16;

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.5);
      doc.line(margin + 1, hy, margin + contentWidth - 1, hy);
      hy += 20;

      // Candidate info fields
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.setDrawColor(90, 90, 90);
      doc.text('Candidate Name:', labelX, hy);
      doc.line(labelX + doc.getTextWidth('Candidate Name:') + 6, hy - 1, halfEnd, hy - 1);
      doc.text('Candidate Number:', colMid, hy);
      doc.line(colMid + doc.getTextWidth('Candidate Number:') + 6, hy - 1, colEnd, hy - 1);
      hy += 22;
      doc.text('Centre Number:', labelX, hy);
      doc.line(labelX + doc.getTextWidth('Centre Number:') + 6, hy - 1, halfEnd, hy - 1);
      doc.text('Date:', colMid, hy);
      doc.line(colMid + doc.getTextWidth('Date:') + 6, hy - 1, colEnd, hy - 1);
      hy += 18;

      doc.setDrawColor(150, 150, 150);
      doc.line(margin + 1, hy, margin + contentWidth - 1, hy);
      hy += 20;

      // Time allowed + total marks band
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(`Time Allowed: ${durationStr}`, labelX, hy);
      doc.text(`Total Marks: ${totalMarks}`, colEnd, hy, { align: 'right' });
      hy += 12;

      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(1);
      doc.rect(margin, headerTop, contentWidth, hy - headerTop);
      doc.setLineWidth(0.5);
      y = hy + 26;

      // ---------- 2. Standardised instructions panel ----------
      const instructions = [
        'Write your Centre number, candidate number and name on all the work you hand in.',
        'Write in dark blue or black pen. You may use an HB pencil for any diagrams or graphs.',
        'Do not use staples, paper clips, glue or correction fluid.',
        'Answer ALL questions.',
        'You may use an electronic calculator unless otherwise stated.',
        'Show all necessary working; marks may be awarded for correct methods.',
        'The number of marks is given in brackets [ ] at the end of each question or part question.',
        'At the end of the examination, fasten all your work securely together.',
      ];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const instrLines = instructions.map((line) => doc.splitTextToSize(line, contentWidth - 44));
      const instrLineCount = instrLines.reduce((sum, lines) => sum + lines.length, 0);
      const instrH = 32 + instrLineCount * 12 + 8;

      ensureSpace(instrH + 20);

      doc.setDrawColor(120, 120, 120);
      doc.setFillColor(249, 250, 252);
      doc.rect(margin, y, contentWidth, instrH, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(20, 20, 20);
      doc.text('READ THESE INSTRUCTIONS FIRST', pageWidth / 2, y + 20, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(50, 50, 50);
      let iy = y + 38;
      for (const lines of instrLines) {
        for (let li = 0; li < lines.length; li++) {
          if (li === 0) {
            doc.setFillColor(50, 50, 50);
            doc.circle(margin + 20, iy - 2.5, 1.2, 'F');
          }
          doc.text(lines[li], margin + 30, iy);
          iy += 12;
        }
      }

      y += instrH + 26;

      // ---------- 3. Questions (number / text / right-aligned [marks]) ----------
      const questions = assessment.questions || [];
      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        const qNum = q.order_index || idx + 1;
        const qText = q.text || '';

        y += 6;
        ensureSpace(40);

        // Question stem: KaTeX math image, Urdu RTL image, or native vector text
        let stemImg: HTMLCanvasElement | null = null;
        let splitStem: string[] = [];
        let stemH = 0;

        if (containsMath(qText)) {
          stemImg = await renderMathTextToImage(qText, textWidth, 10);
        } else if (containsUrdu(qText)) {
          stemImg = await renderTextToImage(qText, textWidth, 10, true);
        }

        if (stemImg) {
          stemH = (stemImg.height / 2) * 0.75 + 6;
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          splitStem = doc.splitTextToSize(qText, textWidth);
          stemH = splitStem.length * 13 + 6;
        }

        // Keep question number + stem + mark allocation on the same page
        ensureSpace(stemH + 14);

        // Right-aligned mark allocation, level with the first stem line
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(20, 20, 20);
        doc.text(`[${q.marks ?? 1}]`, pageWidth - margin, y + 10, { align: 'right' });

        // Bold question number at the left margin
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`${qNum}`, margin, y + 10);

        if (stemImg) {
          doc.addImage(
            stemImg.toDataURL('image/png'),
            'PNG',
            margin + indent,
            y,
            textWidth,
            (stemImg.height / 2) * 0.75
          );
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(30, 30, 30);
          for (let li = 0; li < splitStem.length; li++) {
            doc.text(splitStem[li], margin + indent, y + 10 + li * 13);
          }
        }
        y += stemH + 10;

        // Embedded diagram: left-aligned under the stem, aspect ratio preserved
        if (q.diagram_image_url) {
          try {
            const diagUrl = getUploadFileUrl(q.diagram_image_url);
            const imgRes = await fetch(diagUrl);
            if (imgRes.ok) {
              const imgBlob = await imgRes.blob();
              const imgBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(imgBlob);
              });
              // Measure natural dimensions to preserve aspect ratio in the PDF
              const dims = await new Promise<{ w: number; h: number }>((resolve) => {
                const probe = new Image();
                probe.onload = () => resolve({ w: probe.naturalWidth || 1, h: probe.naturalHeight || 1 });
                probe.onerror = () => resolve({ w: 1, h: 1 });
                probe.src = imgBase64;
              });
              // Compact diagram sizing: cap at 200pt wide x 150pt tall so
              // extracted tables/figures render small beside the question text
              const MAX_DIAG_WIDTH = 200;  // pt
              const MAX_DIAG_HEIGHT = 150; // pt
              let diagWidth = Math.min(textWidth, MAX_DIAG_WIDTH);
              let diagHeight = diagWidth * (dims.h / dims.w);
              if (diagHeight > MAX_DIAG_HEIGHT) {
                // Scale down to fit the height cap while preserving aspect ratio
                diagHeight = MAX_DIAG_HEIGHT;
                diagWidth = diagHeight * (dims.w / dims.h);
              }
              // Page break if diagram would overflow the page bottom
              if (y + diagHeight > bottomLimit) { newPage(); }
              doc.addImage(imgBase64, 'PNG', margin + indent, y, diagWidth, diagHeight);
              y += diagHeight + 12;
            }
          } catch (imgErr) {
            // Skip diagram if fetch fails
          }
        }

        if (q.question_type === 'mcq' && q.options && q.options.length > 0) {
          // MCQ options: checkbox + bold letter + math-aware option text
          const optIndent = margin + indent + 14;
          const optTextWidth = contentWidth - indent - 14 - 34;

          for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
            const opt = q.options[optIdx] || '';
            const letter = String.fromCharCode(65 + optIdx);

            let optImg: HTMLCanvasElement | null = null;
            let splitOpt: string[] = [];
            let optH = 16;

            if (containsMath(opt)) {
              optImg = await renderMathTextToImage(opt, optTextWidth - 16, 9.5);
            } else if (containsUrdu(opt)) {
              optImg = await renderTextToImage(opt, optTextWidth - 16, 9.5, true);
            }

            if (optImg) {
              optH = Math.max(16, (optImg.height / 2) * 0.75 + 3);
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9.5);
              splitOpt = doc.splitTextToSize(opt, optTextWidth - 16);
              optH = Math.max(16, splitOpt.length * 13 + 3);
            }

            ensureSpace(optH + 6);

            // Checkbox + bold option letter
            doc.setDrawColor(90, 90, 90);
            doc.rect(margin + indent + 2, y + 1, 9, 9);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(30, 30, 30);
            doc.text(letter, optIndent, y + 10);

            if (optImg) {
              doc.addImage(
                optImg.toDataURL('image/png'),
                'PNG',
                optIndent + 16,
                y - 1,
                (optImg.width / 2) * 0.75,
                (optImg.height / 2) * 0.75
              );
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9.5);
              doc.setTextColor(50, 50, 50);
              for (let li = 0; li < splitOpt.length; li++) {
                doc.text(splitOpt[li], optIndent + 16, y + 10 + li * 13);
              }
            }
            y += optH + 6;
          }
          y += 8;
        } else {
          // Ruled answer space, aligned to the question text column
          const lineCount = q.answer_lines || (q.question_type === 'long' ? 8 : 4);
          const boxHeight = Math.max(48, lineCount * 20);

          ensureSpace(boxHeight + 34);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(130, 130, 130);
          doc.text('ANSWER', margin + indent, y + 4);
          y += 12;

          doc.setDrawColor(170, 175, 185);
          doc.setFillColor(252, 253, 255);
          doc.rect(margin + indent, y, textWidth, boxHeight, 'FD');

          // Light ruled guide lines inside the answer box
          doc.setDrawColor(228, 232, 240);
          for (let lineY = y + 20; lineY < y + boxHeight; lineY += 20) {
            doc.line(margin + indent + 8, lineY, margin + indent + textWidth - 8, lineY);
          }

          y += boxHeight + 20;
        }
      }

      // ---------- 4. Footers: [Turn over] indicators + dynamic pagination ----------
      const pageCount = doc.getNumberOfPages();
      const examYear = new Date().getFullYear();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(90, 90, 90);
        doc.text(`Page ${p} of ${pageCount}`, margin, pageHeight - 32);
        doc.text(`© ${examYear} EvalAssist AI`, pageWidth / 2, pageHeight - 32, { align: 'center' });
        if (p < pageCount) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          doc.text('[Turn over', pageWidth - margin, pageHeight - 32, { align: 'right' });
        }
      }

      const fileName = `${(assessment.title || 'Assessment').replace(/\s+/g, '_')}_Paper.pdf`;
      doc.save(fileName);
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      alert('PDF generation error. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
        <div className="bg-bg-surface border border-border max-w-md w-full p-8 rounded-3xl text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-status-attention mx-auto" />
          <h2 className="text-lg font-bold text-text-primary">Unable to Enter Assessment</h2>
          <p className="text-xs text-text-secondary">{error}</p>
          <Link
            href="/student/dashboard"
            className="inline-block bg-bg-surface-2 text-text-primary px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-accent hover:text-bg-base transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRole="student">
      <div className="min-h-screen bg-bg-base text-text-primary px-4 py-3 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-8 w-full max-w-full overflow-x-hidden box-border">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-text-primary tracking-tight">
                Student Assessment Portal
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 bg-status-mastered/10 border border-status-mastered/30 text-status-mastered rounded-full text-[10px] sm:text-xs font-bold font-mono">
                <ShieldCheck className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                <span>SECURE</span>
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-text-secondary mt-1">
              {attemptData?.assessment_title} • {attemptData?.subject} ({attemptData?.total_marks} Marks)
            </p>
          </div>

          <Link
            href="/student/dashboard"
            className="text-xs text-text-secondary hover:text-text-primary transition-colors font-mono"
          >
            Exit to Dashboard
          </Link>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Left Column: Timer, Actions & Guidelines */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            {/* Top Timer Card */}
            <div className="bg-bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4 sm:gap-6">
              <AssessmentTimer
                attemptId={attemptData.attempt_id}
                initialRemainingSeconds={attemptData.remaining_seconds}
                onExpire={() => setIsTimeExpired(true)}
              />

              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadTestPaper}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-bg-surface-2 hover:bg-bg-surface-2/80 text-text-primary border border-border px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-accent" />
                  <span>Download Test (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={!canSubmit}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg-base font-bold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl glow-btn transition-all text-xs cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileCheck className="w-4 h-4" />
                  )}
                  <span>{submitting ? 'Evaluating...' : 'Submit Work'}</span>
                </button>
              </div>
            </div>

            {/* Assessment Guidelines Card */}
            <div className="bg-bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-3.5 sm:space-y-4 shadow-lg">
              <h3 className="text-xs sm:text-sm font-bold text-text-primary flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                <span>Assessment Guidelines</span>
              </h3>

              <div className="space-y-2.5 sm:space-y-3 text-xs text-text-secondary leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-status-highConfidence flex-shrink-0 mt-0.5" />
                  <span>Write your answers directly below each question or write on paper and upload.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-status-highConfidence flex-shrink-0 mt-0.5" />
                  <span>
                    Show all work for partial credit. Uploads must be in standard PDF or image format (Max 15MB).
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-status-attention flex-shrink-0 mt-0.5" />
                  <span>Navigating away from this screen will be logged by EvalAssist.</span>
                </div>
              </div>
            </div>

            {/* Questions List with Answer Area Under Every Question */}
            {assessment?.questions && (
              <div className="bg-bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-lg">
                <h3 className="text-xs sm:text-sm font-bold text-text-primary">Questions to Answer</h3>
                <div className="space-y-5 sm:space-y-6">
                  {assessment.questions.map((q: any) => {
                    const isMcq = q.question_type === 'mcq';
                    const isLong = q.question_type === 'long';
                    const lineCount = q.answer_lines || (isLong ? 8 : 4);
                    let opts: string[] = [];
                    if (isMcq && q.options) {
                      try {
                        opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                      } catch {
                        opts = [];
                      }
                    }

                    return (
                      <div key={q.id} className="p-4 sm:p-5 rounded-2xl bg-bg-surface-2 border border-border/80 space-y-3 sm:space-y-4">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <div className="flex items-center gap-2">
                            <span className="text-accent font-mono">Question {q.order_index}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-bg-base text-text-secondary border border-border">
                              {isMcq ? 'MCQ' : isLong ? `Long (${lineCount} Lines)` : `Short (${lineCount} Lines)`}
                            </span>
                          </div>
                          <span className="text-text-secondary font-mono">{q.marks} Marks</span>
                        </div>
                        <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap font-medium">
                          <MathText>{q.text}</MathText>
                        </p>

                        {/* Render linked diagram image for MCQ questions */}
                        {q.diagram_image_url && (
                          <div className="flex justify-center my-2">
                            <img
                              src={getUploadFileUrl(q.diagram_image_url)}
                              alt={`Diagram for Question ${q.order_index}`}
                              className="w-full max-w-[320px] h-auto rounded-xl border border-border object-contain shadow-md"
                            />
                          </div>
                        )}

                        {/* Dedicated Answer Space for Every Question */}
                        <div className="pt-2 border-t border-border/50 space-y-2">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary font-mono">
                            Your Answer:
                          </label>

                          {isMcq && opts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {opts.map((opt: string, optIdx: number) => {
                                const letter = String.fromCharCode(65 + optIdx);
                                const isSelected = answers[q.id] === `(${letter}) ${opt}` || answers[q.id] === opt;

                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    onClick={() => setAnswers({ ...answers, [q.id]: `(${letter}) ${opt}` })}
                                    className={`flex items-start gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-accent text-bg-base border-accent font-bold shadow-glow-accent'
                                        : 'bg-bg-base border-border text-text-primary hover:border-accent/50'
                                    }`}
                                  >
                                    <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold font-mono flex-shrink-0 mt-0.5 ${
                                      isSelected ? 'bg-bg-base text-accent' : 'bg-bg-surface-2 text-text-secondary'
                                    }`}>
                                      {letter}
                                    </span>
                                    {opt !== letter && (
                                      <span className="flex-1 whitespace-pre-wrap leading-relaxed">
                                        <MathText>{opt}</MathText>
                                      </span>
                                    )}
                                    {opt === letter && (
                                      <span className="flex-1 text-text-secondary italic">— see table above —</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <textarea
                              rows={Math.max(2, Math.min(20, lineCount))}
                              value={answers[q.id] || ''}
                              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                              placeholder={`Write your answer here (${lineCount} lines recommended)...`}
                              className="w-full bg-bg-base border border-border focus:border-accent rounded-xl p-3 sm:p-3.5 text-xs text-text-primary outline-none transition-colors resize-y font-mono"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Upload Dropzone & AI Status */}
          <div className="lg:col-span-5 space-y-5 sm:space-y-6">
            {/* Upload Dropzone */}
            <div className="bg-bg-surface border-2 border-dashed border-border hover:border-accent/60 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center transition-all shadow-xl flex flex-col items-center justify-center min-h-[220px] sm:min-h-[260px]">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent mb-3 sm:mb-4">
                <UploadCloud className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>

              <h3 className="text-sm sm:text-base font-bold text-text-primary mb-1">
                Drag &amp; Drop PDF or Photo Here
              </h3>
              <p className="text-xs text-text-secondary mb-4">
                or click to browse files (PDF, PNG, JPG, Max 15MB)
              </p>

              <label className="cursor-pointer bg-bg-surface-2 hover:bg-bg-surface-2/80 border border-border text-text-primary px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-colors">
                <span>{selectedFile ? selectedFile.name : 'Select Answer Sheet'}</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  disabled={submitting || isTimeExpired}
                  className="hidden"
                />
              </label>

              {selectedFile && (
                <div className="mt-4 flex items-center gap-2 text-xs text-status-highConfidence font-medium">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span className="break-all">File attached: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>

            {/* AI Status Indicator Card */}
            <AIStatusIndicator status={aiStatus} message={aiMessage} />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
