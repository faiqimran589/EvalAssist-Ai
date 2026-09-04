'use client';

import React from 'react';
import { BookOpen, Award, Clock, Calendar, ArrowRight, X, AlertTriangle } from 'lucide-react';

interface DetailsStepProps {
  formData: {
    title: string;
    subject: string;
    total_marks: number;
    duration_minutes: number;
    due_date: string;
  };
  updateFormData: (fields: Partial<DetailsStepProps['formData']>) => void;
  onNext: () => void;
}

export default function DetailsStep({
  formData,
  updateFormData,
  onNext,
}: DetailsStepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.subject || formData.total_marks <= 0) {
      alert('Please fill out all required assessment details.');
      return;
    }
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 w-full max-w-full box-border">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Title */}
        <div className="md:col-span-2">
          <label className="block text-[11px] sm:text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 sm:mb-2 font-mono">
            Assessment Title
          </label>
          <div className="relative">
            <BookOpen className="w-4 h-4 text-text-secondary absolute left-3.5 top-3 sm:top-3.5" />
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateFormData({ title: e.target.value })}
              placeholder="e.g. Midterm Physics — Electromagnetism"
              className="w-full bg-bg-surface border border-border focus:border-accent text-text-primary pl-10 pr-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm outline-none transition-colors"
              required
            />
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-[11px] sm:text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 sm:mb-2 font-mono">
            Subject / Curriculum
          </label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => updateFormData({ subject: e.target.value })}
            placeholder="e.g. Physics, Mathematics, Urdu, Chemistry"
            className="w-full bg-bg-surface border border-border focus:border-accent text-text-primary px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm outline-none transition-colors"
            required
          />
        </div>

        {/* Total Marks */}
        <div>
          <label className="block text-[11px] sm:text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 sm:mb-2 font-mono">
            Total Marks
          </label>
          <div className="relative">
            <Award className="w-4 h-4 text-text-secondary absolute left-3.5 top-3 sm:top-3.5" />
            <input
              type="number"
              min="1"
              max="500"
              value={formData.total_marks || ''}
              onChange={(e) => updateFormData({ total_marks: Number(e.target.value) })}
              placeholder="50"
              className="w-full bg-bg-surface border border-border focus:border-accent text-text-primary pl-10 pr-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm outline-none transition-colors"
              required
            />
          </div>
        </div>

        {/* Duration (Minutes) */}
        <div>
          <label className="block text-[11px] sm:text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 sm:mb-2 font-mono">
            Duration (Minutes)
          </label>
          <div className="relative">
            <Clock className="w-4 h-4 text-text-secondary absolute left-3.5 top-3 sm:top-3.5" />
            <input
              type="number"
              min="5"
              max="360"
              value={formData.duration_minutes || ''}
              onChange={(e) => updateFormData({ duration_minutes: Number(e.target.value) })}
              placeholder="60"
              className="w-full bg-bg-surface border border-border focus:border-accent text-text-primary pl-10 pr-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm outline-none transition-colors"
              required
            />
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-[11px] sm:text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 sm:mb-2 font-mono">
            Due Date &amp; Time (Optional)
          </label>
          <div className="relative">
            <Calendar className="w-4 h-4 text-text-secondary absolute left-3.5 top-3 sm:top-3.5 pointer-events-none" />
            <input
              type="datetime-local"
              value={formData.due_date}
              onChange={(e) => updateFormData({ due_date: e.target.value })}
              className="w-full bg-bg-surface border border-border focus:border-accent text-text-primary pl-10 pr-10 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm outline-none transition-colors [color-scheme:dark]"
            />
            {formData.due_date && (
              <button
                type="button"
                onClick={() => updateFormData({ due_date: '' })}
                className="absolute right-3 top-3 sm:top-3.5 p-0.5 rounded-md text-text-secondary hover:text-status-attention hover:bg-bg-surface-2 transition-colors"
                title="Clear due date"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {formData.due_date && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <AlertTriangle className="w-3 h-3 text-status-needs-review flex-shrink-0" />
              <span className="text-[10px] sm:text-[11px] text-text-secondary">
                After the deadline passes, no new attempts or submissions will be accepted.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          type="submit"
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-semibold py-2.5 sm:py-3 px-5 sm:px-6 rounded-xl glow-btn transition-all text-xs sm:text-sm cursor-pointer"
        >
          <span>Next: Questions</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
