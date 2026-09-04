'use client';

import React, { useState } from 'react';
import { api, getUploadFileUrl, isTimeoutError } from '@/lib/api';
import { compressImageForUpload } from '@/lib/imageCompression';
import {
  Sparkles,
  Type,
  ScanLine,
  UploadCloud,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  BarChart3
} from 'lucide-react';

export interface LevelBand {
  level: number;
  min_marks: number;
  max_marks: number;
  descriptor: string;
}

export interface QuestionItem {
  id?: string;
  order_index: number;
  text: string;
  marks: number;
  question_type?: 'short' | 'long' | 'mcq';
  answer_lines?: number;
  options?: string[];
  correct_answer?: string;
  marking_scheme?: 'point_based' | 'level_based';
  level_bands?: LevelBand[];
  diagram_image_url?: string | null;
  key_points?: Array<{ text: string; points: number; is_mandatory_keyword?: boolean; formatting?: any }>;
  deductions?: Array<{ error_condition: string; penalty: number }>;
}

interface QuestionsStepProps {
  questions: QuestionItem[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionItem[]>>;
  onNext: () => void;
  onBack: () => void;
}

export default function QuestionsStep({
  questions,
  setQuestions,
  onNext,
  onBack,
}: QuestionsStepProps) {
  const [inputMode, setInputMode] = useState<'rich_text' | 'ai_ocr'>('ai_ocr');
  const [extracting, setExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [diagramsDetected, setDiagramsDetected] = useState<number>(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setExtractSuccess(false);
    setExtractError(null);
    setDiagramsDetected(0);

    try {
      // Compress oversized photos in-browser before upload: 1200px max side,
      // JPEG q0.75, target <500KB. Cuts payload transmission from ~40s to <2s.
      const uploadFile = await compressImageForUpload(file);

      const formData = new FormData();
      formData.append('file', uploadFile);

      // Run question OCR and diagram extraction in parallel
      const diagramForm = new FormData();
      diagramForm.append('file', uploadFile);

      const [res, diagramRes] = await Promise.allSettled([
        api.extractQuestions(formData),
        api.extractDiagrams(diagramForm),
      ]);

      // Process question extraction result
      if (res.status === 'fulfilled') {
        const data = res.value;
        if (data && data.questions && data.questions.length > 0) {
          const extractedQuestions: QuestionItem[] = data.questions.map((q: any, idx: number) => ({
            order_index: idx + 1,
            text: q.text,
            marks: q.marks || 5,
            question_type: q.question_type || (q.marks >= 8 ? 'long' : 'short'),
            answer_lines: q.answer_lines || (q.question_type === 'long' ? 8 : 4),
            options: q.options || [],
            correct_answer: q.correct_answer || (q.options && q.options.length > 0 ? q.options[0] : ''),
            diagram_image_url: q.diagram_image_url || null,
            key_points: [],
            deductions: [],
          }));

          // Gemini Vision already cropped & linked diagrams via bounding boxes.
          // Fall back to edge-density detection for MCQs still missing a diagram.
          const diagrams = diagramRes.status === 'fulfilled' && diagramRes.value?.diagrams
            ? diagramRes.value.diagrams
            : [];

          let linkedFromBBox = 0;
          for (const eq of extractedQuestions) {
            if (eq.diagram_image_url) linkedFromBBox++;
          }

          if (diagrams.length > 0) {
            // Link remaining diagrams to MCQ questions lacking one (1:1 mapping)
            let diagIdx = 0;
            for (const eq of extractedQuestions) {
              if (
                eq.question_type === 'mcq' &&
                !eq.diagram_image_url &&
                diagIdx < diagrams.length
              ) {
                eq.diagram_image_url = diagrams[diagIdx].image_url;
                diagIdx++;
              }
            }
          }

          setDiagramsDetected(linkedFromBBox + diagrams.length);

          setQuestions(extractedQuestions);
          setExtractSuccess(true);
        } else if (data && data.error) {
          setExtractError(data.error);
        } else {
          setExtractError('No questions could be extracted from the uploaded document. Please ensure the file contains legible questions.');
        }
      } else {
        const reason = (res as PromiseRejectedResult).reason;
        setExtractError(
          isTimeoutError(reason)
            ? 'OCR extraction timed out. Please try uploading a clearer single-page image.'
            : `OCR Extraction Failed: ${reason?.message || 'Unknown error'}`
        );
      }
    } catch (err: any) {
      setExtractError(
        isTimeoutError(err)
          ? 'OCR extraction timed out. Please try uploading a clearer single-page image.'
          : `OCR Extraction Failed: ${err.message}`
      );
    } finally {
      // ALWAYS reset the loading state — success, failure, or timeout.
      setExtracting(false);
      // Reset the input so re-selecting the same file re-triggers onChange.
      e.target.value = '';
    }
  };

  const handleAddQuestion = () => {
    const nextIndex = questions.length + 1;
    setQuestions([
      ...questions,
      {
        order_index: nextIndex,
        text: '',
        marks: 5,
        question_type: 'short',
        answer_lines: 4,
        options: [],
        correct_answer: '',
        key_points: [],
        deductions: [],
      },
    ]);
  };

  const handleUpdateQuestion = (index: number, field: keyof QuestionItem, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleTypeChange = (index: number, type: 'short' | 'long' | 'mcq') => {
    const updated = [...questions];
    const current = updated[index];
    let defaultLines = 4;
    let defaultOpts: string[] = [];

    if (type === 'long') {
      defaultLines = 8;
    } else if (type === 'short') {
      defaultLines = 4;
    } else if (type === 'mcq') {
      defaultOpts = current.options && current.options.length > 0 ? current.options : ['', '', '', ''];
    }

    updated[index] = {
      ...current,
      question_type: type,
      answer_lines: type === 'mcq' ? undefined : (current.answer_lines || defaultLines),
      options: type === 'mcq' ? defaultOpts : [],
    };
    setQuestions(updated);
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, val: string) => {
    const updated = [...questions];
    const opts = [...(updated[qIndex].options || ['', '', '', ''])];
    opts[optIndex] = val;
    updated[qIndex].options = opts;
    setQuestions(updated);
  };

  const handleAddOption = (qIndex: number) => {
    const updated = [...questions];
    const opts = [...(updated[qIndex].options || [])];
    opts.push('');
    updated[qIndex].options = opts;
    setQuestions(updated);
  };

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    const opts = (updated[qIndex].options || []).filter((_, idx) => idx !== optIndex);
    updated[qIndex].options = opts;
    setQuestions(updated);
  };

  const handleDeleteQuestion = (index: number) => {
    const filtered = questions.filter((_, idx) => idx !== index);
    const reindexed = filtered.map((q, idx) => ({ ...q, order_index: idx + 1 }));
    setQuestions(reindexed);
  };

  const handleNext = () => {
    if (questions.length === 0) {
      alert('Please add at least one question to the assessment.');
      return;
    }
    const hasEmptyText = questions.some((q) => !q.text.trim());
    if (hasEmptyText) {
      alert('Please ensure all question text fields are filled.');
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex items-center gap-2 bg-bg-surface-2/60 p-1 rounded-xl border border-border w-fit">
        <button
          type="button"
          onClick={() => setInputMode('rich_text')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            inputMode === 'rich_text'
              ? 'bg-bg-surface text-text-primary shadow'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Rich-Text Builder</span>
        </button>

        <button
          type="button"
          onClick={() => setInputMode('ai_ocr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            inputMode === 'ai_ocr'
              ? 'bg-accent text-bg-base shadow-glow-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span>AI OCR Import</span>
        </button>
      </div>

      {/* AI OCR Dropzone Area */}
      {inputMode === 'ai_ocr' && (
        <div className="border-2 border-dashed border-border hover:border-accent/60 bg-bg-surface rounded-2xl p-8 text-center transition-all">
          <div className="max-w-md mx-auto flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent mb-4">
              {extracting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <ScanLine className="w-6 h-6" />
              )}
            </div>

            <h3 className="text-base font-bold text-text-primary mb-1">
              Drag & Drop your question paper here
            </h3>
            <p className="text-xs text-text-secondary mb-5 leading-relaxed">
              Upload a PDF or photo of your question paper. Gemini will extract questions, type classification, and line allocations.
            </p>

            <label className="cursor-pointer bg-bg-surface-2 hover:bg-bg-surface-2/80 border border-border text-text-primary px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-accent" />
              <span>{extracting ? 'Processing OCR...' : 'Browse Files'}</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
                disabled={extracting}
                className="hidden"
              />
            </label>

            {extractSuccess && (
              <div className="flex items-center gap-2 mt-4 text-status-highConfidence text-xs font-medium bg-status-highConfidence/10 border border-status-highConfidence/30 px-4 py-2 rounded-xl">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  Questions extracted successfully!
                  {diagramsDetected > 0 && (
                    <span className="ml-1 text-accent">
                      {diagramsDetected} diagram{diagramsDetected > 1 ? 's' : ''} detected and linked to MCQ questions.
                    </span>
                  )}
                </span>
              </div>
            )}

            {extractError && (
              <div className="flex items-start gap-2 mt-4 text-status-attention text-xs font-medium bg-status-attention/10 border border-status-attention/30 p-3.5 rounded-xl text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{extractError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Questions Preview & Edit List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-status-mastered" />
            <h3 className="text-xs font-bold text-status-mastered uppercase tracking-wider">
              {inputMode === 'ai_ocr' ? 'AI Extraction Preview' : 'Configured Questions'}
            </h3>
          </div>
          <span className="text-xs text-text-secondary font-mono">
            {questions.length} Question{questions.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-5">
          {questions.map((q, idx) => {
            const currentType = q.question_type || 'short';
            const isNonMcq = currentType !== 'mcq';

            return (
              <div
                key={idx}
                className="bg-bg-surface border border-border hover:border-border/80 rounded-2xl p-5 transition-all space-y-4 shadow-sm"
              >
                {/* Header: Question Number, Type Selector, Marks, Delete */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-text-primary">Question {q.order_index}</span>

                    {/* Question Type Selector */}
                    <div className="flex items-center bg-bg-base p-1 rounded-xl border border-border text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => handleTypeChange(idx, 'short')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          currentType === 'short'
                            ? 'bg-accent text-bg-base font-bold shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        Short Answer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTypeChange(idx, 'long')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          currentType === 'long'
                            ? 'bg-accent text-bg-base font-bold shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        Long Answer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTypeChange(idx, 'mcq')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          currentType === 'mcq'
                            ? 'bg-accent text-bg-base font-bold shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        MCQ
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-bg-base border border-border px-3 py-1 rounded-xl">
                      <span className="text-xs text-text-secondary">Marks:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={q.marks}
                        onChange={(e) =>
                          handleUpdateQuestion(idx, 'marks', Number(e.target.value))
                        }
                        className="w-12 bg-transparent text-text-primary text-xs font-bold font-mono outline-none text-right"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(idx)}
                      className="text-text-secondary hover:text-status-attention p-1.5 rounded-lg hover:bg-bg-surface-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <textarea
                  value={q.text}
                  onChange={(e) => handleUpdateQuestion(idx, 'text', e.target.value)}
                  placeholder="Enter question text or prompt..."
                  rows={currentType === 'long' ? 4 : 2}
                  className="w-full bg-bg-base border border-border focus:border-accent text-text-primary p-3 rounded-xl text-sm outline-none resize-none transition-colors"
                />

                {/* If NOT MCQ: Ask teacher how many lines should be provided */}
                {isNonMcq && (
                  <div className="bg-bg-base/70 border border-border/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold text-text-primary block">
                        How many lines should be provided for this question?
                      </label>
                      <p className="text-[11px] text-text-secondary">
                        Sets the ruled writing space in student view & generated PDF test sheets.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-bg-surface border border-border px-3 py-1.5 rounded-xl">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={q.answer_lines ?? (currentType === 'long' ? 8 : 4)}
                        onChange={(e) =>
                          handleUpdateQuestion(idx, 'answer_lines', Math.max(1, Number(e.target.value)))
                        }
                        className="w-14 bg-transparent text-accent text-xs font-bold font-mono outline-none text-center"
                      />
                      <span className="text-xs font-medium text-text-secondary">Lines</span>
                    </div>
                  </div>
                )}

                {/* Level-Based Marking Scheme for Long Answers */}
                {isNonMcq && (
                  <div className="bg-bg-base/70 border border-border/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-status-mastered" />
                          <span>Marking Scheme Type</span>
                        </label>
                        <p className="text-[11px] text-text-secondary">
                          Choose how the AI grades this question: point-by-point rubric or holistic level bands.
                        </p>
                      </div>
                      <div className="flex items-center bg-bg-surface p-1 rounded-xl border border-border text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuestion(idx, 'marking_scheme', 'point_based')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${
                            (q.marking_scheme || 'point_based') === 'point_based'
                              ? 'bg-accent text-bg-base font-bold shadow-sm'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Point-Based</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateQuestion(idx, 'marking_scheme', 'level_based');
                            if (!q.level_bands || q.level_bands.length === 0) {
                              const marks = q.marks || 12;
                              const bandSize = Math.ceil(marks / 3);
                              handleUpdateQuestion(idx, 'level_bands', [
                                { level: 1, min_marks: 1, max_marks: bandSize, descriptor: 'Basic / limited response' },
                                { level: 2, min_marks: bandSize + 1, max_marks: bandSize * 2, descriptor: 'Competent / adequate response' },
                                { level: 3, min_marks: bandSize * 2 + 1, max_marks: marks, descriptor: 'Excellent / sophisticated response' },
                              ]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg transition-all ${
                            q.marking_scheme === 'level_based'
                              ? 'bg-status-mastered text-bg-base font-bold shadow-sm'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" />
                            <span>Level-Based</span>
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Level Bands Editor */}
                    {q.marking_scheme === 'level_based' && (
                      <div className="space-y-2 pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-status-mastered uppercase tracking-wider">
                            Level Band Descriptors
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const bands = q.level_bands || [];
                              const lastBand = bands[bands.length - 1];
                              const nextLevel = (lastBand?.level || 0) + 1;
                              handleUpdateQuestion(idx, 'level_bands', [
                                ...bands,
                                { level: nextLevel, min_marks: (lastBand?.max_marks || 0) + 1, max_marks: (lastBand?.max_marks || 0) + 4, descriptor: '' }
                              ]);
                            }}
                            className="text-accent text-[11px] font-semibold hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Level</span>
                          </button>
                        </div>

                        {(q.level_bands || []).map((band, bandIdx) => (
                          <div key={bandIdx} className="flex items-start gap-2 bg-bg-surface border border-border rounded-xl p-3">
                            <div className="flex flex-col items-center gap-0.5 min-w-[50px]">
                              <span className="text-[10px] font-bold text-status-mastered uppercase">Level</span>
                              <span className="text-lg font-bold text-text-primary font-mono">{band.level}</span>
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-bg-base border border-border rounded-lg px-2 py-1">
                                  <input
                                    type="number"
                                    min={1}
                                    max={q.marks}
                                    value={band.min_marks}
                                    onChange={(e) => {
                                      const bands = [...(q.level_bands || [])];
                                      bands[bandIdx] = { ...bands[bandIdx], min_marks: Number(e.target.value) };
                                      handleUpdateQuestion(idx, 'level_bands', bands);
                                    }}
                                    className="w-10 bg-transparent text-accent text-xs font-bold font-mono outline-none text-center"
                                  />
                                  <span className="text-[10px] text-text-secondary">to</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={q.marks}
                                    value={band.max_marks}
                                    onChange={(e) => {
                                      const bands = [...(q.level_bands || [])];
                                      bands[bandIdx] = { ...bands[bandIdx], max_marks: Number(e.target.value) };
                                      handleUpdateQuestion(idx, 'level_bands', bands);
                                    }}
                                    className="w-10 bg-transparent text-accent text-xs font-bold font-mono outline-none text-center"
                                  />
                                  <span className="text-[10px] text-text-secondary font-mono">marks</span>
                                </div>
                              </div>
                              <textarea
                                value={band.descriptor}
                                onChange={(e) => {
                                  const bands = [...(q.level_bands || [])];
                                  bands[bandIdx] = { ...bands[bandIdx], descriptor: e.target.value };
                                  handleUpdateQuestion(idx, 'level_bands', bands);
                                }}
                                placeholder="Describe the quality expected at this level (e.g. argument depth, vocabulary, structure)"
                                rows={2}
                                className="w-full bg-bg-base border border-border focus:border-accent text-text-primary px-3 py-2 rounded-lg text-xs outline-none resize-none transition-colors"
                              />
                            </div>
                            {(q.level_bands || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const bands = (q.level_bands || []).filter((_, i) => i !== bandIdx);
                                  handleUpdateQuestion(idx, 'level_bands', bands);
                                }}
                                className="text-text-secondary hover:text-status-attention p-1 rounded-lg hover:bg-bg-surface-2 transition-colors mt-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* If MCQ: Provide option fields and correct answer selector */}
                {currentType === 'mcq' && (
                  <div className="bg-bg-base/70 border border-border/80 rounded-xl p-4 space-y-4">
                    {/* Diagram Image Preview (from OCR extraction) */}
                    {q.diagram_image_url && (
                      <div className="flex items-start gap-3 bg-bg-surface border border-accent/30 rounded-xl p-3">
                        <img
                          src={getUploadFileUrl(q.diagram_image_url)}
                          alt="Associated diagram"
                          className="w-full max-w-[320px] h-auto my-2 rounded-lg border border-border object-contain"
                        />
                        <div className="flex-1 space-y-1">
                          <span className="text-[11px] font-bold text-accent uppercase tracking-wider block">
                            Extracted Diagram
                          </span>
                          <p className="text-[10px] text-text-secondary">
                            This diagram was auto-detected from your uploaded paper and linked to this MCQ question.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(idx, 'diagram_image_url', null)}
                            className="text-[11px] text-status-attention font-semibold hover:underline"
                          >
                            Remove diagram link
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary">
                        Multiple Choice Options:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddOption(idx)}
                        className="text-accent text-[11px] font-semibold hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Option</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {(q.options && q.options.length > 0 ? q.options : ['', '', '', '']).map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isCorrect = q.correct_answer === opt || q.correct_answer === letter || q.correct_answer === `(${letter}) ${opt}`;

                        return (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-2 bg-bg-surface border rounded-xl px-3 py-1.5 transition-all ${
                              isCorrect ? 'border-status-highConfidence/60 bg-status-highConfidence/5' : 'border-border'
                            }`}
                          >
                            <span className="text-xs font-mono font-bold text-accent">
                              {letter}.
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                handleUpdateOption(idx, optIdx, e.target.value);
                                if (isCorrect) {
                                  handleUpdateQuestion(idx, 'correct_answer', `(${letter}) ${e.target.value}`);
                                }
                              }}
                              placeholder={`Option ${letter}`}
                              className="w-full bg-transparent text-xs text-text-primary outline-none"
                            />
                            {(q.options?.length || 4) > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(idx, optIdx)}
                                className="text-text-secondary hover:text-status-attention p-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Correct Option Selector for Deterministic Grading */}
                    <div className="pt-3 border-t border-border/60">
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">
                        Select Correct Option (for Automatic MCQ Grading):
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(q.options && q.options.length > 0 ? q.options : ['', '', '', '']).map((opt, optIdx) => {
                          const letter = String.fromCharCode(65 + optIdx);
                          const valueToSet = `(${letter}) ${opt}`;
                          const isSelected = q.correct_answer === valueToSet || q.correct_answer === opt || q.correct_answer === letter;

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleUpdateQuestion(idx, 'correct_answer', valueToSet)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border ${
                                isSelected
                                  ? 'bg-status-highConfidence text-bg-base border-status-highConfidence font-bold shadow-sm'
                                  : 'bg-bg-surface text-text-secondary border-border hover:border-accent/40'
                              }`}
                            >
                              Option {letter} {isSelected && '✓ (Correct)'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Question Manually */}
          <button
            type="button"
            onClick={handleAddQuestion}
            className="w-full border border-dashed border-border hover:border-accent/60 bg-bg-surface/50 hover:bg-bg-surface py-3.5 rounded-2xl text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 text-accent" />
            <span>Add Question Manually</span>
          </button>
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
          <span>Back to Details</span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-semibold py-3 px-6 rounded-xl glow-btn transition-all text-sm"
        >
          <span>Next: Define Rubric</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
