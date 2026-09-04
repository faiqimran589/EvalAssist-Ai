'use client';

import React, { useState } from 'react';
import { api, isTimeoutError } from '@/lib/api';
import { compressImageForUpload } from '@/lib/imageCompression';
import MathText from '@/components/MathText';
import { QuestionItem } from './QuestionsStep';
import {
  CheckCircle2,
  MinusCircle,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  GripVertical,
  Sliders,
  HelpCircle,
  UploadCloud,
  Loader2,
  AlertCircle,
  FileCheck,
  Lock,
  Bold
} from 'lucide-react';

interface RubricStepProps {
  questions: QuestionItem[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionItem[]>>;
  totalMarksTarget: number;
  onNext: () => void;
  onBack: () => void;
}

export default function RubricStep({
  questions,
  setQuestions,
  totalMarksTarget,
  onNext,
  onBack,
}: RubricStepProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const selectedQuestion = questions[selectedIndex] || questions[0];
  const isSelectedMcq = selectedQuestion?.question_type === 'mcq';

  // Compute total marks configured across all questions
  const totalConfigured = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  const pctConfigured = totalMarksTarget > 0 ? Math.min(100, Math.round((totalConfigured / totalMarksTarget) * 100)) : 100;

  const handleAddKeyPoint = () => {
    const updated = [...questions];
    const currentKps = updated[selectedIndex].key_points || [];
    const defaultPts = Math.max(0.5, Math.round(((selectedQuestion?.marks || 5) / (currentKps.length + 1)) * 10) / 10);
    updated[selectedIndex].key_points = [...currentKps, { text: '', points: defaultPts }];
    setQuestions(updated);
  };

  const handleUpdateKeyPoint = (kpIdx: number, field: string, value: any) => {
    const updated = [...questions];
    const kps = [...(updated[selectedIndex].key_points || [])];
    kps[kpIdx] = { ...kps[kpIdx], [field]: value };
    updated[selectedIndex].key_points = kps;
    setQuestions(updated);
  };

  const handleDeleteKeyPoint = (kpIdx: number) => {
    const updated = [...questions];
    updated[selectedIndex].key_points = (updated[selectedIndex].key_points || []).filter((_, idx) => idx !== kpIdx);
    setQuestions(updated);
  };

  const handleAddDeduction = () => {
    const updated = [...questions];
    const currentDeds = updated[selectedIndex].deductions || [];
    updated[selectedIndex].deductions = [...currentDeds, { error_condition: '', penalty: -1.0 }];
    setQuestions(updated);
  };

  const handleUpdateDeduction = (dIdx: number, field: 'error_condition' | 'penalty', value: any) => {
    const updated = [...questions];
    const deds = [...(updated[selectedIndex].deductions || [])];
    deds[dIdx] = { ...deds[dIdx], [field]: value };
    updated[selectedIndex].deductions = deds;
    setQuestions(updated);
  };

  const handleDeleteDeduction = (dIdx: number) => {
    const updated = [...questions];
    updated[selectedIndex].deductions = (updated[selectedIndex].deductions || []).filter((_, idx) => idx !== dIdx);
    setQuestions(updated);
  };

  const handleImportAnswerKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportSuccess(false);
    setImportError(null);

    try {
      // Compress oversized photos in-browser before upload: 1200px max side,
      // JPEG q0.75, target <500KB (PDFs and .txt pass through untouched).
      const uploadFile = await compressImageForUpload(file);

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('questions', JSON.stringify(questions.map(q => ({
        order_index: q.order_index,
        text: q.text,
        marks: q.marks,
        question_type: q.question_type || 'short',
        options: q.options || []
      }))));

      const res = await api.extractBulkAnswerKey(formData);

      if (res && res.success && res.rubrics) {
        // Apply the extracted rubrics to all questions
        const updated = [...questions];
        let appliedCount = 0;

        for (const q of updated) {
          const orderIdx = q.order_index;
          const rubric = res.rubrics[orderIdx] || res.rubrics[String(orderIdx)];

          if (rubric && (rubric.key_points?.length > 0 || rubric.deductions?.length > 0)) {
            // Merge or replace key_points
            if (rubric.key_points && rubric.key_points.length > 0) {
              q.key_points = rubric.key_points.map((kp: any) => ({
                text: kp.text || '',
                points: kp.points || 1.0
              }));
            }
            // Merge or replace deductions
            if (rubric.deductions && rubric.deductions.length > 0) {
              q.deductions = rubric.deductions.map((d: any) => ({
                error_condition: d.error_condition || '',
                penalty: d.penalty || -1.0
              }));
            }
            appliedCount++;
          }
        }

        setQuestions(updated);
        setImportSuccess(true);
        setImportError(null);

        // Reset success message after 5 seconds
        setTimeout(() => setImportSuccess(false), 5000);
      } else if (res && res.error) {
        setImportError(res.error);
      } else {
        setImportError('Could not extract answer key from the uploaded document. Please ensure it contains a clear marking scheme.');
      }
    } catch (err: any) {
      setImportError(
        isTimeoutError(err)
          ? 'OCR extraction timed out. Please try uploading a clearer single-page image.'
          : `Import failed: ${err.message}`
      );
    } finally {
      // ALWAYS reset the loading state — success, failure, or timeout.
      setImporting(false);
      // Reset file input
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Import Answer Key Section */}
      <div className="bg-bg-surface border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              {importing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <UploadCloud className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Import Answer Key</h3>
              <p className="text-[11px] text-text-secondary">
                Upload a marking scheme/answer key document to automatically apply rubrics to all questions.
              </p>
            </div>
          </div>

          <label className={`cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            importing
              ? 'bg-bg-surface-2 border border-border text-text-secondary cursor-not-allowed'
              : 'bg-accent hover:bg-accent-hover text-bg-base border border-accent glow-btn'
          }`}>
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Upload Answer Key</span>
              </>
            )}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
              onChange={handleImportAnswerKey}
              disabled={importing}
              className="hidden"
            />
          </label>
        </div>

        {importSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-status-highConfidence/10 border border-status-highConfidence/30 text-status-highConfidence text-xs font-medium">
            <FileCheck className="w-4 h-4 flex-shrink-0" />
            <span>Answer key imported and applied successfully to all matching questions!</span>
          </div>
        )}

        {importError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-status-attention/10 border border-status-attention/30 text-status-attention text-xs font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{importError}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Questions List & Total Indicator */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-bg-surface border border-border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-text-primary mb-2">Questions</h3>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isSelected = idx === selectedIndex;
                const isMcq = q.question_type === 'mcq';
                const kpCount = q.key_points?.length || 0;
                const dedCount = q.deductions?.length || 0;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-bg-surface-2 border-accent text-text-primary shadow-glow-accent'
                        : 'bg-bg-base/60 border-border text-text-secondary hover:text-text-primary hover:bg-bg-surface-2/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-text-primary">Question {q.order_index}</span>
                        {isMcq ? (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-bg-base border border-border text-text-secondary">
                            MCQ
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-bg-base border border-border text-accent font-semibold">
                            {kpCount} Criteria
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full font-mono">
                        {q.marks} Marks
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                      <MathText>{q.text || 'Untitled Question'}</MathText>
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Total Marks Configured Indicator */}
            <div className="border-t border-border pt-4 mt-4 flex items-center justify-between">
              <div>
                <span className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                  Total Marks Configured
                </span>
                <span className="text-xl font-bold text-text-primary font-mono">
                  {totalConfigured} / {totalMarksTarget}
                </span>
                {totalConfigured !== totalMarksTarget && (
                  <span className="block text-[11px] text-status-needsReview mt-0.5">
                    Target is {totalMarksTarget} marks
                  </span>
                )}
              </div>

              {/* Score Progress Ring */}
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    stroke="#202636"
                    strokeWidth="3"
                    fill="transparent"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    stroke="#FF6B4A"
                    strokeWidth="3"
                    strokeDasharray="113"
                    strokeDashoffset={113 - (113 * pctConfigured) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold font-mono text-text-primary">
                  {pctConfigured}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Question Details, Expected Key Points, Deductions */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-bg-surface-2 border border-border rounded-lg text-xs font-bold text-text-primary font-mono">
                  Question {selectedQuestion?.order_index}
                </span>
                <span className="text-xs font-semibold text-text-secondary font-mono">
                  {selectedQuestion?.marks} Marks Total
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-bg-base border border-border text-accent font-bold">
                  {selectedQuestion?.question_type || 'short'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary font-mono">
                  Manual Teacher Marking Scheme
                </span>
              </div>
            </div>

            {/* Read-Only Question Text */}
            <div>
              <span className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">
                Question Text
              </span>
              <div className="p-3.5 rounded-xl bg-bg-base border border-border text-xs text-text-primary leading-relaxed font-medium whitespace-pre-wrap">
                <MathText>{selectedQuestion?.text || 'No question text provided.'}</MathText>
              </div>
            </div>

            {/* If MCQ Question: Show Deterministic Notice */}
            {isSelectedMcq ? (
              <div className="bg-bg-base/70 border border-status-highConfidence/40 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-status-highConfidence font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Deterministic MCQ Evaluation</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  MCQ answers are evaluated deterministically by matching the student&apos;s choice against the configured correct option. No rubric rules are required.
                </p>
                <div className="p-3 bg-bg-surface border border-border rounded-xl flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Configured Correct Option:</span>
                  <span className="font-mono font-bold text-status-highConfidence">
                    {selectedQuestion?.correct_answer || (selectedQuestion?.options?.[0] ? selectedQuestion.options[0] : 'Option A')}
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Expected Key Points */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-status-mastered">
                      <CheckCircle2 className="w-4 h-4" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        Expected Key Points (Grading Criteria)
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddKeyPoint}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Key Point</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    Specify formulas, keywords, concepts, and steps that the student must satisfy to earn marks.
                    Toggle <span className="inline-flex items-center gap-0.5"><Bold className="w-3 h-3" />Mandatory Keyword</span> to enforce exact term matching (Cambridge O-Level style).
                  </p>

                  <div className="space-y-2">
                    {(!selectedQuestion?.key_points || selectedQuestion.key_points.length === 0) ? (
                      <div className="p-4 rounded-xl bg-bg-base/40 border border-dashed border-border text-center">
                        <p className="text-xs text-text-secondary mb-2">No key points added yet.</p>
                        <button
                          type="button"
                          onClick={handleAddKeyPoint}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-bg-base text-xs font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add First Key Point</span>
                        </button>
                      </div>
                    ) : (
                      selectedQuestion.key_points.map((kp, kpIdx) => (
                        <div key={kpIdx} className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-text-secondary/40 cursor-grab flex-shrink-0" />
                          <input
                            type="text"
                            value={kp.text}
                            onChange={(e) => handleUpdateKeyPoint(kpIdx, 'text', e.target.value)}
                            placeholder="e.g. Accurate definition, formula V=IR, or specific derivation step"
                            className={`flex-1 bg-bg-base border focus:border-accent text-text-primary px-3.5 py-2.5 rounded-xl text-xs outline-none ${
                              kp.is_mandatory_keyword ? 'border-accent/60 font-bold' : 'border-border'
                            }`}
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              max="100"
                              value={kp.points}
                              onChange={(e) =>
                                handleUpdateKeyPoint(kpIdx, 'points', Number(e.target.value))
                              }
                              className="w-14 bg-bg-base border border-border focus:border-accent text-accent font-mono font-bold px-2 py-2.5 rounded-xl text-xs text-center outline-none"
                            />
                            <span className="text-[11px] text-text-secondary font-mono">pts</span>
                          </div>
                          {/* Mandatory Keyword Toggle */}
                          <button
                            type="button"
                            onClick={() => handleUpdateKeyPoint(kpIdx, 'is_mandatory_keyword', !kp.is_mandatory_keyword)}
                            title={kp.is_mandatory_keyword ? 'Mandatory keyword ON — student must use this exact term' : 'Conceptual match — synonyms accepted'}
                            className={`p-2 rounded-lg transition-colors ${
                              kp.is_mandatory_keyword
                                ? 'bg-accent/20 text-accent border border-accent/40'
                                : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-2'
                            }`}
                          >
                            <Bold className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKeyPoint(kpIdx)}
                            className="text-text-secondary hover:text-status-attention p-2 rounded-lg hover:bg-bg-surface-2 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Deduction Rules */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-status-attention">
                      <MinusCircle className="w-4 h-4" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        Deduction Rules (Penalties)
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddDeduction}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-status-attention/15 hover:bg-status-attention/25 border border-status-attention/30 text-status-attention text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Deduction</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    Specify common mistakes, missing units, or incorrect assertions and their penalties.
                  </p>

                  <div className="space-y-2">
                    {(!selectedQuestion?.deductions || selectedQuestion.deductions.length === 0) ? (
                      <div className="p-3 rounded-xl bg-bg-base/30 border border-border/50 text-center">
                        <p className="text-xs text-text-secondary">No deduction rules configured (optional).</p>
                      </div>
                    ) : (
                      selectedQuestion.deductions.map((d, dIdx) => (
                        <div key={dIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={d.error_condition}
                            onChange={(e) =>
                              handleUpdateDeduction(dIdx, 'error_condition', e.target.value)
                            }
                            placeholder="e.g. Missing units, sign error, or calculation mistake"
                            className="flex-1 bg-bg-base border border-border focus:border-accent text-text-primary px-3.5 py-2.5 rounded-xl text-xs outline-none"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              value={d.penalty}
                              onChange={(e) =>
                                handleUpdateDeduction(dIdx, 'penalty', -Math.abs(Number(e.target.value)))
                              }
                              className="w-16 bg-bg-base border border-border focus:border-accent text-status-attention font-mono font-bold px-2 py-2.5 rounded-xl text-xs text-center outline-none"
                            />
                            <span className="text-[11px] text-text-secondary font-mono">pts</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteDeduction(dIdx)}
                            className="text-text-secondary hover:text-status-attention p-2 rounded-lg hover:bg-bg-surface-2 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Questions</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-semibold py-3 px-6 rounded-xl glow-btn transition-all text-sm"
        >
          <span>Next: Review &amp; Finalize</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
