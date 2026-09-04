'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUploadFileUrl } from '@/lib/api';
import MathText from '@/components/MathText';
import { QuestionItem } from './QuestionsStep';
import {
  Sparkles,
  Rocket,
  Smartphone,
  Copy,
  Check,
  ArrowLeft,
  Loader2,
  Clock,
  Award,
  ListOrdered,
  GraduationCap
} from 'lucide-react';

interface FinalizeStepProps {
  formData: {
    title: string;
    subject: string;
    total_marks: number;
    duration_minutes: number;
    due_date: string;
  };
  questions: QuestionItem[];
  onBack: () => void;
}

export default function FinalizeStep({
  formData,
  questions,
  onBack,
}: FinalizeStepProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [generatedAssessment, setGeneratedAssessment] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleSaveAndGenerate = async () => {
    setSaving(true);
    try {
      // 1. Create assessment with questions & rubrics
      const payload = {
        title: formData.title,
        subject: formData.subject,
        total_marks: formData.total_marks,
        duration_minutes: formData.duration_minutes,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        questions: questions.map((q) => ({
          order_index: q.order_index,
          text: q.text,
          marks: q.marks,
          question_type: q.question_type || 'short',
          answer_lines: q.question_type === 'mcq' ? 0 : (q.answer_lines ?? (q.question_type === 'long' ? 8 : 4)),
          options: q.question_type === 'mcq' ? (q.options || []) : [],
          correct_answer: q.correct_answer || null,
          marking_scheme: q.marking_scheme || null,
          level_bands: q.marking_scheme === 'level_based' ? (q.level_bands || []) : null,
          diagram_image_url: q.diagram_image_url || null,
          key_points: (q.key_points || []).map((kp) => ({
            text: kp.text,
            points: kp.points,
            is_mandatory_keyword: kp.is_mandatory_keyword || false,
            formatting: kp.formatting || null,
          })),
          deductions: q.deductions || [],
        })),
      };

      const created = await api.createAssessment(payload);

      // 2. Publish & lock assessment to make it immutable & live
      const published = await api.publishAssessment(created.id);
      setGeneratedAssessment(published);
    } catch (err: any) {
      alert(`Failed to generate assessment: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = () => {
    if (!generatedAssessment) return;
    const shareUrl = `${window.location.origin}/join/${generatedAssessment.share_token}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Assessment Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h3 className="text-base font-bold text-text-primary">Assessment Summary</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Total Marks */}
              <div className="bg-bg-surface-2 p-4 rounded-xl border border-border">
                <span className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Total Marks
                </span>
                <span className="text-3xl font-bold font-mono text-text-primary">
                  {formData.total_marks}
                </span>
              </div>

              {/* Duration */}
              <div className="bg-bg-surface-2 p-4 rounded-xl border border-border">
                <span className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Duration
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold font-mono text-text-primary">
                    {formData.duration_minutes}
                  </span>
                  <span className="text-xs text-text-secondary font-mono">m</span>
                </div>
              </div>

              {/* Questions Count */}
              <div className="col-span-2 bg-bg-surface-2 p-4 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <span className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                    Questions
                  </span>
                  <span className="text-3xl font-bold font-mono text-text-primary">
                    {questions.length}
                  </span>
                </div>
                <ListOrdered className="w-8 h-8 text-text-secondary/40" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                Once generated, this assessment will be locked and ready for distribution to your students.
              </p>

              <button
                type="button"
                onClick={handleSaveAndGenerate}
                disabled={saving || generatedAssessment !== null}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg-base font-bold py-3.5 px-6 rounded-xl glow-btn transition-all text-sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Locking & Publishing...</span>
                  </>
                ) : generatedAssessment ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Assessment Published!</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    <span>Save & Generate Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Share Token Card */}
          {generatedAssessment && (
            <div className="bg-bg-surface border border-accent/40 p-6 rounded-2xl shadow-glow-accent space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">
                  Share Token Ready
                </span>
                <span className="text-xs text-status-highConfidence font-semibold">● Live</span>
              </div>

              <div className="p-4 bg-bg-base rounded-xl border border-border text-center">
                <span className="block text-xs text-text-secondary mb-1">Quick Join Token</span>
                <span className="text-3xl font-bold font-mono text-accent tracking-widest">
                  {generatedAssessment.share_token}
                </span>
              </div>

              <button
                type="button"
                onClick={copyShareLink}
                className="w-full flex items-center justify-center gap-2 bg-bg-surface-2 hover:bg-bg-surface-2/80 border border-border text-text-primary text-xs font-semibold py-3 rounded-xl transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-status-highConfidence" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/submissions')}
                  className="flex-1 text-center py-2.5 rounded-xl text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-base border border-border transition-colors"
                >
                  Go to Submissions
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="flex-1 text-center py-2.5 rounded-xl text-xs font-medium text-accent bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors"
                >
                  Overview
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Simulated Student Preview */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                <Smartphone className="w-4 h-4" />
                <span>Student Preview</span>
              </div>
              <span className="text-[10px] font-mono font-medium text-status-mastered bg-status-mastered/10 border border-status-mastered/30 px-2.5 py-0.5 rounded-full">
                Mobile View Simulated
              </span>
            </div>

            {/* Phone Frame */}
            <div className="w-full bg-bg-surface border-4 border-border rounded-3xl p-5 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col justify-between">
              {/* Speaker notch */}
              <div className="w-16 h-1 bg-border rounded-full mx-auto mb-4" />

              <div className="space-y-4">
                {/* Header in phone */}
                <div className="text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center mx-auto mb-2">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-text-primary text-sm leading-snug">
                    {formData.title || 'Midterm Evaluation'}
                  </h4>
                  <p className="text-[11px] text-text-secondary">{formData.subject || 'Subject'}</p>
                </div>

                {/* Simulated Timer Bar */}
                <div className="bg-bg-base p-3 rounded-xl border border-border">
                  <div className="flex justify-between text-[10px] font-mono text-text-secondary mb-1.5">
                    <span>TIME REMAINING ({formData.duration_minutes || 60}m)</span>
                    <span className="text-accent font-bold">
                      {String(formData.duration_minutes || 60).padStart(2, '0')}:00
                    </span>
                  </div>
                  <div className="w-full bg-bg-surface-2 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-accent h-full w-full rounded-full" />
                  </div>
                </div>

                {/* Simulated Question Card */}
                <div className="bg-bg-base/70 p-3.5 rounded-xl border border-border/80 space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-text-primary">
                    <span>Question 1</span>
                    <span className="text-accent font-mono">
                      {questions[0]?.marks || 5} Marks
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    <MathText>{questions[0]?.text || 'No question text provided'}</MathText>
                  </p>
                  {/* Diagram preview below question text */}
                  {questions[0]?.diagram_image_url && (
                    <div className="flex justify-center my-2">
                      <img
                        src={getUploadFileUrl(questions[0].diagram_image_url)}
                        alt="Diagram for Question 1"
                        className="w-full max-w-[320px] h-auto rounded-lg border border-border object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Start CTA in phone */}
              <div className="pt-4">
                <button
                  type="button"
                  disabled
                  className="w-full bg-accent/60 text-bg-base text-xs font-bold py-2.5 rounded-xl text-center cursor-not-allowed"
                >
                  Start Assessment
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back button */}
      <div className="flex items-center justify-start pt-6 border-t border-border">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Rubric</span>
        </button>
      </div>
    </div>
  );
}
