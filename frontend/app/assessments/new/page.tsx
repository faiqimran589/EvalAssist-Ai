'use client';

import React, { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import TeacherSidebar from '@/components/TeacherSidebar';
import DetailsStep from '@/components/AssessmentWizard/DetailsStep';
import QuestionsStep, { QuestionItem } from '@/components/AssessmentWizard/QuestionsStep';
import RubricStep from '@/components/AssessmentWizard/RubricStep';
import FinalizeStep from '@/components/AssessmentWizard/FinalizeStep';
import {
  Check,
  Edit3,
  BookOpen,
  Calendar,
  Clock,
  Award,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function NewAssessmentPage() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    total_marks: 50,
    duration_minutes: 60,
    due_date: '',
  });

  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  const updateFormData = (fields: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const steps = [
    { num: 1, title: 'Details' },
    { num: 2, title: 'Questions' },
    { num: 3, title: 'Rubric' },
    { num: 4, title: 'Finalize' },
  ];

  return (
    <ProtectedRoute allowedRole="teacher">
      <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen lg:overflow-hidden bg-bg-base w-full max-w-full overflow-x-hidden">
        <TeacherSidebar />

        <main className="flex-1 px-4 py-3 sm:p-6 lg:p-8 overflow-y-auto pb-24 sm:pb-28 lg:pb-8 max-w-5xl w-full mx-auto min-w-0 box-border lg:h-screen">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">
                Create New Assessment
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">
                Configure details, import questions, and define rubrics.
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden sm:inline text-xs font-semibold text-text-secondary px-3 py-1 bg-bg-surface rounded-full border border-border">
                Teacher Mode
              </span>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-bold text-xs">
                {user?.name?.charAt(0) || 'P'}
              </div>
            </div>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center justify-between max-w-xl mb-6 sm:mb-8 bg-bg-surface border border-border p-2.5 sm:p-4 rounded-xl sm:rounded-2xl">
            {steps.map((s, idx) => {
              const isCompleted = currentStep > s.num;
              const isCurrent = currentStep === s.num;

              return (
                <React.Fragment key={s.num}>
                  <div className="flex items-center gap-1.5 sm:gap-2.5">
                    <div
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold font-mono transition-all ${
                        isCompleted
                          ? 'bg-accent text-bg-base'
                          : isCurrent
                          ? 'bg-accent text-bg-base shadow-glow-accent'
                          : 'bg-bg-surface-2 text-text-secondary border border-border'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" /> : s.num}
                    </div>
                    <span
                      className={`text-[11px] sm:text-xs font-semibold ${
                        isCurrent
                          ? 'text-accent'
                          : isCompleted
                          ? 'text-text-primary'
                          : 'text-text-secondary'
                      }`}
                    >
                      <span className="hidden sm:inline">{s.title}</span>
                      <span className="sm:hidden">{isCurrent ? s.title : ''}</span>
                    </span>
                  </div>

                  {idx < steps.length - 1 && (
                    <div
                      className={`flex-1 h-[1.5px] sm:h-[2px] mx-1 sm:mx-2 rounded-full transition-all ${
                        isCompleted ? 'bg-accent' : 'bg-border'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Collapsed Step 1 Summary if on Step > 1 */}
          {currentStep > 1 && (
            <div className="bg-bg-surface border border-border rounded-2xl p-5 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-status-highConfidence/15 border border-status-highConfidence/30 text-status-highConfidence flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Step 1: Details
                  </h4>
                  <div className="flex items-center gap-4 mt-1 text-xs text-text-primary font-medium">
                    <span>
                      <strong className="text-text-secondary">Title:</strong> {formData.title || 'Untitled'}
                    </span>
                    <span>
                      <strong className="text-text-secondary">Subject:</strong> {formData.subject}
                    </span>
                    <span>
                      <strong className="text-text-secondary">Marks:</strong> {formData.total_marks}
                    </span>
                    <span>
                      <strong className="text-text-secondary">Duration:</strong> {formData.duration_minutes}m
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover font-semibold px-3 py-1.5 rounded-lg hover:bg-bg-surface-2 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>EDIT</span>
              </button>
            </div>
          )}

          {/* Active Step Content */}
          <div className="bg-bg-surface border border-border rounded-3xl p-8 shadow-xl">
            {currentStep === 1 && (
              <div>
                <h2 className="text-lg font-bold text-text-primary mb-6">Step 1: Assessment Details</h2>
                <DetailsStep
                  formData={formData}
                  updateFormData={updateFormData}
                  onNext={() => setCurrentStep(2)}
                />
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <h2 className="text-lg font-bold text-text-primary mb-6">Step 2: Question Input</h2>
                <QuestionsStep
                  questions={questions}
                  setQuestions={setQuestions}
                  onNext={() => setCurrentStep(3)}
                  onBack={() => setCurrentStep(1)}
                />
              </div>
            )}

            {currentStep === 3 && (
              <div>
                <h2 className="text-lg font-bold text-text-primary mb-6">Step 3: Define Grading Rubric</h2>
                <RubricStep
                  questions={questions}
                  setQuestions={setQuestions}
                  totalMarksTarget={formData.total_marks}
                  onNext={() => setCurrentStep(4)}
                  onBack={() => setCurrentStep(2)}
                />
              </div>
            )}

            {currentStep === 4 && (
              <div>
                <h2 className="text-lg font-bold text-text-primary mb-6">Step 4: Review & Finalize</h2>
                <FinalizeStep
                  formData={formData}
                  questions={questions}
                  onBack={() => setCurrentStep(3)}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
