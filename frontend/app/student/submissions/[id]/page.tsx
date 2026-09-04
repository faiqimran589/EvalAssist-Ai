'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import StudentSidebar from '@/components/StudentSidebar';
import AnswerAnnotationCanvas from '@/components/AnswerAnnotationCanvas';
import MathText from '@/components/MathText';
import { api, getUploadFileUrl } from '@/lib/api';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Loader2,
  BookOpen,
  FileText,
  Award,
  AlertCircle,
  ExternalLink,
  Download,
  Image as ImageIcon
} from 'lucide-react';

export default function StudentSubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;

  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'questions' | 'document'>('questions');

  useEffect(() => {
    if (!submissionId) return;

    const fetchDetail = async () => {
      try {
        const data = await api.getStudentSubmissionDetail(submissionId);
        setSubmission(data);
      } catch (err) {
        console.error('Error fetching student submission detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [submissionId]);

  const handleHelpMeImprove = () => {
    let targetConcept = 'General Curriculum';
    for (const qg of submission?.question_grades || []) {
      if (qg.deducted_points && qg.deducted_points.length > 0) {
        targetConcept = qg.deducted_points[0].concept || targetConcept;
        break;
      }
    }
    router.push(`/student/learning-path?concept=${encodeURIComponent(targetConcept)}`);
  };

  const isPublished = submission?.status === 'published';
  const fileUrl = submission?.file_path ? getUploadFileUrl(submission.file_path) : '';
  const isPdf = submission?.file_path?.toLowerCase().endsWith('.pdf');
  const isImage = submission?.file_path && /\.(png|jpe?g|webp|gif)$/i.test(submission.file_path);
  const hasUploadedFile = Boolean(submission?.file_path && (isPdf || isImage));

  return (
    <ProtectedRoute allowedRole="student">
      <div className="flex flex-col lg:flex-row min-h-screen bg-bg-base">
        <StudentSidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 sm:pb-28 lg:pb-8 max-w-7xl w-full mx-auto space-y-6 min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Link
              href="/student/submissions"
              className="flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to My Submissions</span>
            </Link>

            <span className="text-xs text-text-secondary font-medium truncate max-w-sm">
              {submission?.assessment_title} • {isPublished ? 'Official Result' : 'Under Review'}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : !submission ? (
            <div className="text-center p-12 text-text-secondary">Submission not found.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left/Main Column: Actual Submitted Test Paper with Questions & Answers */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-8 shadow-xl">
                  {/* Test Paper Header */}
                  <div className="border-b border-border pb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">
                        {submission.subject}
                      </span>
                      <h1 className="text-2xl font-bold text-text-primary mt-1">
                        {submission.assessment_title}
                      </h1>
                      <p className="text-xs text-text-secondary mt-1">
                        Student: <strong className="text-text-primary">{submission.student_name}</strong> • Submitted Test Evaluation
                      </p>
                    </div>

                    <div className="text-right bg-bg-surface-2 border border-border px-5 py-3 rounded-2xl">
                      <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        Official Score
                      </span>
                      <span className="text-3xl font-bold font-mono text-accent">
                        {isPublished ? submission.overall_score : '—'}
                      </span>
                      <span className="text-sm font-bold font-mono text-text-secondary">
                        {' '}/ {submission.total_marks} Marks
                      </span>
                    </div>
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
                        <span>Submitted Questions & Answers</span>
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
                        <span>Uploaded Answer Sheet ({isPdf ? 'PDF' : 'Image'})</span>
                      </button>
                    </div>
                  )}

                  {/* View 1: Questions & Answers List */}
                  {activeTab === 'questions' && (
                    <div className="space-y-8">
                      {submission.question_grades && submission.question_grades.length > 0 ? (
                        submission.question_grades.map((qg: any, idx: number) => (
                          <div
                            key={qg.id || idx}
                            className="bg-bg-base/70 border border-border/80 rounded-2xl p-6 space-y-5"
                          >
                            {/* Question Header */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono bg-accent/15 text-accent border border-accent/30">
                                  Question {qg.order_index || idx + 1}
                                </span>
                                <h3 className="text-sm font-semibold text-text-primary leading-relaxed pt-1 whitespace-pre-wrap">
                                  <MathText>{qg.question_text || `Question ${idx + 1}`}</MathText>
                                </h3>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span className="inline-block px-3 py-1 bg-bg-surface border border-border rounded-xl font-mono font-bold text-xs text-accent">
                                  {isPublished ? `${qg.marks_awarded} / ${qg.marks_total} Marks` : `Max: ${qg.marks_total} Marks`}
                                </span>
                              </div>
                            </div>

                            {/* Student's Submitted Answer */}
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                                Student&apos;s Submitted Answer:
                              </label>
                              <div className="bg-bg-surface border border-border rounded-xl p-4 text-xs font-mono text-text-primary leading-relaxed min-h-[70px] whitespace-pre-wrap">
                                {qg.extracted_answer_text ? (
                                  qg.extracted_answer_text
                                ) : hasUploadedFile ? (
                                  <div className="flex items-center justify-between text-text-secondary py-1">
                                    <span>[Answer provided in uploaded answer sheet]</span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('document')}
                                      className="text-accent text-[11px] font-semibold hover:underline flex items-center gap-1"
                                    >
                                      <span>View Uploaded Sheet</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-text-secondary italic">
                                    [No answer submitted for this question]
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Question Feedback & Evaluation (Only if published) */}
                            {isPublished && (
                              <div className="pt-2 border-t border-border/50 space-y-3">
                                {/* Correct Points / Rubric Met */}
                                {qg.correct_points && qg.correct_points.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-status-highConfidence uppercase tracking-wider">
                                      Key Criteria Met:
                                    </span>
                                    <div className="space-y-1">
                                      {qg.correct_points.map((pt: string, pIdx: number) => (
                                        <div
                                          key={pIdx}
                                          className="flex items-center gap-2 text-xs text-status-highConfidence"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                                          <span>{pt}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Deductions / Areas for Improvement */}
                                {qg.deducted_points && qg.deducted_points.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-status-attention uppercase tracking-wider">
                                      Deduction Details:
                                    </span>
                                    <div className="space-y-1">
                                      {qg.deducted_points.map((d: any, dIdx: number) => (
                                        <div
                                          key={dIdx}
                                          className="flex items-center gap-2 text-xs text-status-attention"
                                        >
                                          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                          <span>
                                            {typeof d === 'string' ? d : d.issue || d.reason || 'Deduction applied'}
                                            {d.penalty ? ` (${d.penalty} pts)` : ''}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Improvement Tip */}
                                {qg.improvement_tip && (
                                  <div className="text-xs text-text-secondary bg-bg-surface/80 p-3 rounded-xl border border-border/80 leading-relaxed">
                                    <strong className="text-accent">Feedback / Tip:</strong> {qg.improvement_tip}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-text-secondary text-xs">
                          No individual question breakdown found for this submission.
                        </div>
                      )}
                    </div>
                  )}

                  {/* View 2: Uploaded Document / Answer Sheet */}
                  {activeTab === 'document' && hasUploadedFile && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-bg-surface-2 p-3 rounded-xl border border-border text-xs">
                        <span className="text-text-secondary">
                          Uploaded File: <strong className="text-text-primary">{submission.file_path.split('/').pop()}</strong>
                        </span>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-accent/15 hover:bg-accent text-accent hover:text-bg-base font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Open / Download Original</span>
                        </a>
                      </div>

                      {isPdf ? (
                        <div className="border border-border rounded-2xl overflow-hidden bg-bg-base h-[650px]">
                          <iframe
                            src={`${fileUrl}#toolbar=1`}
                            title="Submitted PDF Document"
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
                                title="AI Examiner Annotations — Your Answer Sheet"
                              />
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Score Summary & Teacher Approved Feedback (English Only) */}
              <div className="lg:col-span-4 space-y-6">
                {/* Score Status Card */}
                <div className="bg-bg-surface border border-border rounded-3xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-text-primary">
                      {isPublished ? 'Evaluation Finalized' : 'Awaiting Teacher Review'}
                    </h2>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono border ${
                      isPublished
                        ? 'bg-status-highConfidence/15 border-status-highConfidence/30 text-status-highConfidence'
                        : 'bg-status-needsReview/15 border-status-needsReview/30 text-status-needsReview'
                    }`}>
                      {isPublished ? 'Approved' : 'Under Review'}
                    </span>
                  </div>

                  <div className="p-4 bg-bg-surface-2 rounded-2xl border border-border flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-bold text-text-secondary uppercase">
                        Percentage
                      </span>
                      <span className="text-2xl font-bold font-mono text-accent">
                        {isPublished && submission.total_marks > 0
                          ? `${Math.round((submission.overall_score / submission.total_marks) * 100)}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold text-text-secondary uppercase">
                        Score
                      </span>
                      <span className="text-lg font-bold font-mono text-text-primary">
                        {isPublished ? submission.overall_score : '—'} / {submission.total_marks}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Teacher-Approved Feedback Card (ENGLISH ONLY) */}
                <div className="bg-bg-surface border border-border rounded-3xl p-6 space-y-3 shadow-xl">
                  <div className="flex items-center gap-2 text-accent">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      Teacher-Approved Feedback
                    </h3>
                  </div>

                  <div className="p-4 bg-bg-surface-2 rounded-2xl border border-border text-xs text-text-primary leading-relaxed">
                    <p>
                      {submission.ai_summary_en ||
                        (isPublished
                          ? 'Your assessment has been evaluated, graded, and finalized with official feedback.'
                          : 'Your submission has been received. Detailed scores and teacher feedback will be available upon official approval.')}
                    </p>
                  </div>
                </div>

                {/* Help Me Improve CTA */}
                {isPublished && (
                  <button
                    onClick={handleHelpMeImprove}
                    className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-bold py-3.5 px-6 rounded-2xl glow-btn transition-all text-sm shadow-xl"
                  >
                    <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                    <span>Help Me Improve</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
