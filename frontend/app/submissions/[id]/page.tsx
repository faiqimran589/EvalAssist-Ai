'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import TeacherSidebar from '@/components/TeacherSidebar';
import AnswerAnnotationCanvas from '@/components/AnswerAnnotationCanvas';
import MathText from '@/components/MathText';
import { api, getUploadFileUrl } from '@/lib/api';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Save,
  Loader2,
  FileCheck,
  Check,
  X,
  FileText,
  User,
  ExternalLink,
  Download,
  Image as ImageIcon
} from 'lucide-react';

export default function TeacherSubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;

  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'document'>('questions');

  const fetchDetail = async () => {
    try {
      const data = await api.getSubmissionDetail(submissionId);
      setSubmission(data);
      const initialOverrides: Record<string, number> = {};
      data.question_grades?.forEach((qg: any) => {
        initialOverrides[qg.id] = qg.marks_awarded;
      });
      setOverrides(initialOverrides);
    } catch (err) {
      console.error('Error loading submission detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (submissionId) {
      fetchDetail();
    }
  }, [submissionId]);

  const handleSaveOverrides = async () => {
    setSavingOverrides(true);
    setActionMessage(null);
    try {
      await api.overrideQuestionGrades(submissionId, overrides);
      setActionMessage('Manual score adjustments saved successfully.');
      await fetchDetail();
    } catch (err: any) {
      alert(`Failed to save mark adjustments: ${err.message}`);
    } finally {
      setSavingOverrides(false);
    }
  };

  const handleFinalizeAndPublish = async () => {
    setPublishing(true);
    setActionMessage(null);
    try {
      await api.overrideQuestionGrades(submissionId, overrides);
      await api.finalizeSubmissionGrades(submissionId);
      setActionMessage('Final approved score published! Result is now visible to student and updated across all portals.');
      await fetchDetail();
    } catch (err: any) {
      alert(`Failed to finalize score: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  const isFinalized = submission?.status === 'published';

  // Compute live working total from overrides
  const currentWorkingTotal = submission?.question_grades?.reduce(
    (acc: number, qg: any) => acc + (overrides[qg.id] ?? qg.marks_awarded ?? 0),
    0
  ) ?? submission?.overall_score ?? 0;

  return (
    <ProtectedRoute allowedRole="teacher">
      <div className="flex flex-col lg:flex-row min-h-screen bg-bg-base">
        <TeacherSidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 sm:pb-28 lg:pb-8 max-w-7xl w-full mx-auto space-y-6 min-w-0">
          {/* Top Back Nav & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Link
              href="/submissions"
              className="flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Submissions</span>
            </Link>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveOverrides}
                disabled={savingOverrides}
                className="bg-bg-surface border border-border hover:bg-bg-surface-2 text-text-primary font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4 text-accent" />
                <span>{savingOverrides ? 'Saving...' : 'Save Changes'}</span>
              </button>

              <button
                onClick={handleFinalizeAndPublish}
                disabled={publishing}
                className={`font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg ${
                  isFinalized
                    ? 'bg-status-highConfidence/20 border border-status-highConfidence/40 text-status-highConfidence hover:bg-status-highConfidence hover:text-bg-base'
                    : 'bg-accent hover:bg-accent-hover text-bg-base glow-btn'
                }`}
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isFinalized ? (
                  <FileCheck className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{isFinalized ? 'Update & Re-Finalize Score' : 'Approve & Finalize Final Score'}</span>
              </button>
            </div>
          </div>

          {actionMessage && (
            <div className="p-4 bg-accent/10 border border-accent/30 text-text-primary text-xs rounded-xl flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2 text-accent font-medium">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <span>{actionMessage}</span>
              </div>
              <button
                onClick={() => setActionMessage(null)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : !submission ? (
            <div className="text-center p-12 text-text-secondary">Submission not found.</div>
          ) : (
            <div className="space-y-6">
              {/* Header Info Card */}
              <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-wrap items-center justify-between gap-6 shadow-xl">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-text-primary">
                      {submission.assessment_title}
                    </h1>
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider font-mono border ${
                      isFinalized
                        ? 'bg-status-highConfidence/15 border-status-highConfidence/30 text-status-highConfidence'
                        : 'bg-status-needsReview/15 border-status-needsReview/30 text-status-needsReview'
                    }`}>
                      {isFinalized ? '● Final Approved & Published' : '○ Under Teacher Review'}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Student: <strong className="text-text-primary">{submission.student_name}</strong> ({submission.student_email}) • Subject: <strong className="text-text-primary">{submission.subject}</strong>
                  </p>
                </div>

                {/* Score Comparison Display */}
                <div className="flex items-center gap-6 divide-x divide-border">
                  <div className="text-right pr-6">
                    <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      AI Initial Evaluation
                    </span>
                    <span className="text-2xl font-bold font-mono text-text-secondary">
                      {submission.preliminary_score} <span className="text-xs">/ {submission.total_marks}</span>
                    </span>
                  </div>

                  <div className="text-right pl-6">
                    <span className="block text-[10px] font-bold text-accent uppercase tracking-wider">
                      {isFinalized ? 'Official Final Score' : 'Teacher Working Score'}
                    </span>
                    <span className="text-3xl font-bold font-mono text-accent">
                      {currentWorkingTotal} <span className="text-sm font-sans font-normal text-text-secondary">/ {submission.total_marks}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Content Grid: Actual Submitted Test (Questions & Answers) on Left, Feedback & Review on Right */}
              {(() => {
                const fileUrl = submission?.file_path ? getUploadFileUrl(submission.file_path) : '';
                const isPdf = submission?.file_path?.toLowerCase().endsWith('.pdf');
                const isImage = submission?.file_path && /\.(png|jpe?g|webp|gif)$/i.test(submission.file_path);
                const hasUploadedFile = Boolean(submission?.file_path && (isPdf || isImage));

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left/Main Column: Student's Actual Submitted Test */}
                    <div className="lg:col-span-8 space-y-6">
                      <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-6 shadow-xl">
                        <div className="flex flex-wrap items-center justify-between border-b border-border pb-4 gap-3">
                          <div>
                            <h2 className="text-base font-bold text-text-primary">
                              Submitted Answer Paper & Mark Adjustment
                            </h2>
                            <p className="text-xs text-text-secondary mt-0.5">
                              Inspect student answers and enter the final mark for each question
                            </p>
                          </div>
                          <span className="text-xs font-mono text-accent font-semibold">
                            {submission.question_grades?.length || 0} Questions
                          </span>
                        </div>

                        {/* Tab Selector if Uploaded Document is attached */}
                        {hasUploadedFile && (
                          <div className="flex items-center gap-2 bg-bg-base/70 p-1.5 rounded-xl border border-border w-fit">
                            <button
                              type="button"
                              onClick={() => setActiveTab('questions')}
                              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                                activeTab === 'questions'
                                  ? 'bg-bg-surface text-text-primary shadow'
                                  : 'text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Questions & Mark Adjustment</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setActiveTab('document')}
                              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                                activeTab === 'document'
                                  ? 'bg-accent text-bg-base shadow-glow-accent'
                                  : 'text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              {isPdf ? <FileText className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                              <span>Uploaded Answer Paper ({isPdf ? 'PDF' : 'Image'})</span>
                            </button>
                          </div>
                        )}

                        {/* View 1: Questions & Student Answers List */}
                        {activeTab === 'questions' && (
                          <div className="space-y-6">
                            {submission.question_grades?.map((qg: any, idx: number) => (
                              <div
                                key={qg.id}
                                className="bg-bg-surface-2 border border-border rounded-xl p-5 space-y-4"
                              >
                                {/* Question Header & Final Mark Input */}
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1 flex-1">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono bg-accent/15 text-accent border border-accent/30">
                                      Question {qg.order_index || idx + 1}
                                    </span>
                                    <h4 className="text-xs font-semibold text-text-primary leading-relaxed pt-1 whitespace-pre-wrap">
                                      <MathText>{qg.question_text || `Question ${idx + 1}`}</MathText>
                                    </h4>
                                  </div>

                                  {/* Manual Final Mark Entry */}
                                  <div className="flex items-center gap-2 bg-bg-base border border-border p-2 rounded-xl">
                                    <span className="text-xs font-semibold text-text-secondary">Final Mark:</span>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      max={qg.marks_total}
                                      value={overrides[qg.id] ?? qg.marks_awarded}
                                      onChange={(e) =>
                                        setOverrides({
                                          ...overrides,
                                          [qg.id]: Number(e.target.value),
                                        })
                                      }
                                      className="w-16 bg-bg-surface border border-accent/40 focus:border-accent text-accent font-mono font-bold px-2 py-1.5 rounded-lg text-xs text-center outline-none"
                                    />
                                    <span className="text-xs font-mono text-text-secondary">
                                      / {qg.marks_total}
                                    </span>
                                  </div>
                                </div>

                                {/* Student's Actual Submitted Answer */}
                                <div className="space-y-1.5">
                                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                                    Student&apos;s Submitted Answer:
                                  </label>
                                  <div className="bg-bg-base border border-border rounded-xl p-4 text-xs font-mono text-text-primary leading-relaxed whitespace-pre-wrap">
                                    {qg.extracted_answer_text ? (
                                      qg.extracted_answer_text
                                    ) : hasUploadedFile ? (
                                      <div className="flex items-center justify-between text-text-secondary py-1">
                                        <span>[Answer submitted on paper / attached document]</span>
                                        <button
                                          type="button"
                                          onClick={() => setActiveTab('document')}
                                          className="text-accent text-[11px] font-semibold hover:underline flex items-center gap-1"
                                        >
                                          <span>Inspect Uploaded Sheet</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-text-secondary italic">
                                        [No answer text recorded for this question]
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* AI Evaluation Reference Details */}
                                <div className="pt-2 border-t border-border/40 space-y-2.5">
                                  {/* Matched Points / Rubric Met */}
                                  {qg.correct_points && qg.correct_points.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-status-highConfidence uppercase tracking-wider">
                                        Rubric Criteria Met:
                                      </span>
                                      {qg.correct_points.map((pt: string, pIdx: number) => (
                                        <div key={pIdx} className="flex items-center gap-2 text-xs text-status-highConfidence">
                                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                                          <span>{pt}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Deductions */}
                                  {qg.deducted_points && qg.deducted_points.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-status-attention uppercase tracking-wider">
                                        Identified Issues & Deductions:
                                      </span>
                                      {qg.deducted_points.map((d: any, dIdx: number) => (
                                        <div key={dIdx} className="flex items-center gap-2 text-xs text-status-attention">
                                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                          <span>
                                            {typeof d === 'string' ? d : d.issue || d.reason || 'Deduction applied'} ({d.penalty || -1} pts)
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Improvement Tip */}
                                  {qg.improvement_tip && (
                                    <div className="text-[11px] text-text-secondary bg-bg-base/70 p-3 rounded-lg border border-border/60">
                                      <strong className="text-accent font-sans">AI Feedback / Tip:</strong> {qg.improvement_tip}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* View 2: Uploaded Document / Answer Sheet */}
                        {activeTab === 'document' && hasUploadedFile && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between bg-bg-surface-2 p-3 rounded-xl border border-border text-xs">
                              <span className="text-text-secondary">
                                Attached Submission: <strong className="text-text-primary">{submission.file_path.split('/').pop()}</strong>
                              </span>
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-accent/15 hover:bg-accent text-accent hover:text-bg-base font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Open Full Document</span>
                              </a>
                            </div>

                            {isPdf ? (
                              <div className="border border-border rounded-2xl overflow-hidden bg-bg-base h-[650px]">
                                <iframe
                                  src={`${fileUrl}#toolbar=1`}
                                  title="Submitted Student PDF"
                                  className="w-full h-full border-0"
                                />
                              </div>
                            ) : (
                              <div className="border border-border rounded-2xl overflow-hidden bg-bg-base min-h-[480px]">
                                {(() => {
                                  const allAnnotations: any[] = [];
                                  submission?.question_grades?.forEach((qg: any) => {
                                    if (qg.annotations) {
                                      try {
                                        const anns = typeof qg.annotations === 'string' ? JSON.parse(qg.annotations) : qg.annotations;
                                        if (Array.isArray(anns)) {
                                          allAnnotations.push(...anns);
                                        }
                                      } catch {}
                                    }
                                  });

                                  return (
                                    <AnswerAnnotationCanvas
                                      imageSrc={fileUrl}
                                      annotations={allAnnotations}
                                      title="AI Examiner Annotations — Handwritten Answer Sheet"
                                    />
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: AI Summary & Grading Overview */}
                    <div className="lg:col-span-4 space-y-6">
                      {/* AI Summary Feedback Panel (English Only, Unwanted Urdu Removed) */}
                      <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-accent">
                            <Sparkles className="w-4 h-4" />
                            <h3 className="text-xs font-bold uppercase tracking-wider">
                              Evaluation Summary & Feedback
                            </h3>
                          </div>
                        </div>

                        <div className="bg-bg-surface-2 p-4 rounded-xl border border-border text-xs text-text-primary leading-relaxed space-y-2">
                          <p>
                            {submission.ai_summary_en ||
                              'AI evaluation completed. Review the individual question marks, verify deductions, and finalize the score.'}
                          </p>
                        </div>
                      </div>

                      {/* Submission Metadata Card */}
                      <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-3 shadow-lg text-xs">
                        <h4 className="font-bold text-text-primary uppercase tracking-wider text-[11px]">
                          Submission Metadata
                        </h4>
                        <div className="space-y-2 text-text-secondary">
                          <div className="flex justify-between">
                            <span>Submitted By:</span>
                            <span className="font-semibold text-text-primary">{submission.student_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Email:</span>
                            <span className="font-mono text-text-primary">{submission.student_email}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Subject:</span>
                            <span className="text-text-primary">{submission.subject}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span className="font-mono font-bold text-accent">{submission.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
