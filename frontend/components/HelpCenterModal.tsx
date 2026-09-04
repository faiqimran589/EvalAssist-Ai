'use client';

import React, { useState } from 'react';
import {
  X,
  HelpCircle,
  ChevronDown,
  Search
} from 'lucide-react';

export interface FAQItem {
  question: string;
  answer: string;
  category?: string;
}

const TEACHER_FAQS: FAQItem[] = [
  {
    question: 'How do I create an assessment?',
    answer: 'Use "New Assessment" in the sidebar — a 4-step wizard walks you through details, adding questions, building the rubric, and finalizing.',
    category: 'Assessment Setup'
  },
  {
    question: 'Do I have to type out every question myself?',
    answer: 'No — on the Questions step, switch to "AI OCR Import," upload a photo or PDF of a printed or handwritten question paper, and the AI extracts each question and its marks for you to review and edit before saving.',
    category: 'OCR & AI'
  },
  {
    question: 'How do I set up grading criteria?',
    answer: 'Rubrics are built into the wizard (Step 3), not a separate page. For each question, add "Expected Key Points" (with point values) and "Deduction Rules" (with penalties) — or upload a photo of your existing answer key and let the AI pre-fill it.',
    category: 'Rubrics & Grading'
  },
  {
    question: 'How do students join my class?',
    answer: 'Once you finalize an assessment, you get a short join token (like EX-992) and a link. Share either one — first-time students create an account through it and get automatically linked to you; returning students just log in.',
    category: 'Enrollment & Class'
  },
  {
    question: 'What does "Needs Review" or a low confidence score mean?',
    answer: 'The AI flags questions or submissions it\'s less certain about instead of guessing. Those stay "Under Teacher Review" until you check them in Student Submissions and click "Publish Grades" — high-confidence submissions publish automatically.',
    category: 'Review & Publishing'
  },
  {
    question: 'Can I see the student\'s actual handwritten answer, not just extracted text?',
    answer: 'Yes — the submission detail view shows the original photo with the AI\'s highlights overlaid on it, toggleable on/off.',
    category: 'Submissions'
  },
  {
    question: 'Can I edit an assessment after publishing it?',
    answer: 'No — once you generate the link, it\'s locked so the questions and rubric can\'t shift under students mid-use. Create a new assessment if you need changes.',
    category: 'Assessment Setup'
  },
  {
    question: 'A student says their internet dropped mid-exam — what do I do?',
    answer: 'Add extra time to their attempt from your portal. Students can\'t reset their own timer, so this is the only way to give someone more time.',
    category: 'Live Exams & Timing'
  },
  {
    question: 'Can a student retake an assessment?',
    answer: 'Not currently — one attempt per student per assessment.',
    category: 'Policies'
  },
  {
    question: 'Is student data safe?',
    answer: 'Submitted answer sheets go to Google\'s Gemini API for OCR and grading; everything else (accounts, scores, rubrics) lives in the platform\'s own database.',
    category: 'Security & Privacy'
  }
];

const STUDENT_FAQS: FAQItem[] = [
  {
    question: 'How do I create an account?',
    answer: 'You can\'t sign up on your own — ask your teacher for their join token or link. Opening it lets you create an account and automatically joins their class.',
    category: 'Getting Started'
  },
  {
    question: 'What do I submit, and how?',
    answer: 'On the Assessment Portal, do your work, then upload a single PDF or clear photo (under 15MB) via drag-and-drop or "Submit Work" before time runs out.',
    category: 'Submissions'
  },
  {
    question: 'Can I take the same test more than once?',
    answer: 'No — one attempt per assessment.',
    category: 'Policies'
  },
  {
    question: 'Can I refresh the page to get more time?',
    answer: 'No — the timer runs on the server, not your browser. If you have a real connection problem, tell your teacher; they can add time from their side.',
    category: 'Exams & Timer'
  },
  {
    question: 'Can I leave the assessment tab during the exam?',
    answer: 'It\'s tracked — navigating away is logged, so stay on the page.',
    category: 'Integrity & Security'
  },
  {
    question: 'How is my work graded?',
    answer: 'Against your teacher\'s rubric — you get marks per question, what you got right, what was missed, and a specific improvement tip.',
    category: 'Grading & Rubrics'
  },
  {
    question: 'What\'s the difference between "High Confidence" and "Under Teacher Review"?',
    answer: 'High Confidence means the grading is final. Under Teacher Review means the AI flagged something uncertain, so your teacher checks it before it\'s locked in — the score might still shift slightly.',
    category: 'Results'
  },
  {
    question: 'Can I see exactly where I lost marks?',
    answer: 'Yes — "View Detailed Feedback" shows your original answer with highlights over what earned credit and what was flagged.',
    category: 'Feedback'
  },
  {
    question: 'What if my internet connection drops or the electricity goes out during the exam?',
    answer: 'Don\'t panic — as soon as you\'re back online, tell your teacher. They can add extra time to your attempt from their portal to make up for what you lost. You can\'t reset your own timer, so reaching out to your teacher is the only way to recover that time.',
    category: 'Exams & Timer'
  },
  {
    question: 'What is "My Learning Path"?',
    answer: 'A personalized plan built from your weak spots — your current focus area, a short revision plan, and practice modules.',
    category: 'Learning Path'
  }
];

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  portal: 'teacher' | 'student';
}

export default function HelpCenterModal({
  isOpen,
  onClose,
  portal,
}: HelpCenterModalProps) {
  const [openIndexes, setOpenIndexes] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const faqs = portal === 'teacher' ? TEACHER_FAQS : STUDENT_FAQS;

  const toggleFAQ = (index: number) => {
    setOpenIndexes((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (faq.category && faq.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-surface border border-border w-full max-w-2xl max-h-[85vh] rounded-3xl p-6 md:p-8 flex flex-col shadow-2xl relative overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-glow-accent">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                {portal === 'teacher' ? 'Teacher Help Center' : 'Student Help Center'}
              </h2>
              <p className="text-xs text-text-secondary">
                Frequently Asked Questions & Platform Guidance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Help Center"
            className="text-text-secondary hover:text-text-primary p-2 rounded-xl hover:bg-bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="my-4 flex-shrink-0 relative">
          <Search className="w-4 h-4 text-accent absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FAQs (e.g. create assessment, rubrics, timer, grading)..."
            className="w-full bg-bg-base border border-border focus:border-accent text-text-primary placeholder:text-text-secondary/60 pl-9 pr-4 py-2.5 rounded-xl text-xs outline-none transition-all"
          />
        </div>

        {/* FAQ Accordion List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="py-12 text-center text-text-secondary text-xs">
              No answers matched your search query &quot;{searchQuery}&quot;.
            </div>
          ) : (
            filteredFaqs.map((faq, index) => {
              const isOpen = Boolean(openIndexes[index]);

              return (
                <div
                  key={index}
                  className={`border rounded-2xl transition-all overflow-hidden ${
                    isOpen
                      ? 'border-accent/40 bg-bg-surface-2/60 shadow-sm'
                      : 'border-border bg-bg-surface hover:border-border-hover'
                  }`}
                >
                  {/* Clickable Question Header */}
                  <button
                    type="button"
                    onClick={() => toggleFAQ(index)}
                    aria-expanded={isOpen}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 select-none group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-bg-base border border-border text-accent text-[11px] font-mono font-bold flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-xs md:text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                        {faq.question}
                      </span>
                    </div>

                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${
                        isOpen
                          ? 'transform rotate-180 bg-accent text-bg-base'
                          : 'bg-bg-base text-text-secondary group-hover:text-text-primary'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Expandable / Collapsible Answer */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs md:text-sm text-text-secondary leading-relaxed border-t border-border/40 animate-fade-in">
                      <p className="pt-2 text-text-primary/90 font-medium">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-text-secondary flex-shrink-0">
          <span>Need further assistance?</span>
          <span className="font-mono text-accent">support@evalassist.ai</span>
        </div>
      </div>
    </div>
  );
}
