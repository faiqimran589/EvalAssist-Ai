'use client';

import React, { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import TeacherSidebar from '@/components/TeacherSidebar';
import {
  ChevronDown,
  Play,
  Mail,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Sparkles,
  MessageSquare
} from 'lucide-react';

interface FAQ {
  q: string;
  a: string;
}

const TEACHER_FAQS: FAQ[] = [
  {
    q: 'How do I create an assessment?',
    a: 'Use "New Assessment" in the sidebar — a 4-step wizard walks you through details, adding questions, building the rubric, and finalizing.'
  },
  {
    q: 'Do I have to type out every question myself?',
    a: 'No — on the Questions step, switch to "AI OCR Import," upload a photo or PDF of a printed or handwritten question paper, and the AI extracts each question and its marks for you to review and edit before saving.'
  },
  {
    q: 'How do I set up grading criteria?',
    a: 'Rubrics are built into the wizard (Step 3), not a separate page. For each question, add "Expected Key Points" (with point values) and "Deduction Rules" (with penalties) manually.'
  },
  {
    q: 'How do students join my class?',
    a: 'Once you finalize an assessment, you get a short join token (like EX-992) and a link. Share either one — first-time students create an account through it and get automatically linked to you; returning students just log in.'
  },
  {
    q: "What does 'Needs Review' or a low confidence score mean?",
    a: "The AI flags questions or submissions it's less certain about instead of guessing. Those stay 'Under Teacher Review' until you check them in Student Submissions and click 'Publish Grades' — high-confidence submissions publish automatically."
  },
  {
    q: "Can I see the student's actual handwritten answer, not just extracted text?",
    a: "Yes — the submission detail view shows the original photo with the AI's highlights overlaid on it, toggleable on/off."
  },
  {
    q: 'A student says their internet dropped or the power went out mid-exam — what do I do?',
    a: "Add extra time to their attempt from your portal. Students can't reset their own timer, so this is the only way to give someone more time."
  },
  {
    q: 'Can I edit an assessment after publishing it?',
    a: "No — once you generate the link, it's locked so the questions and rubric can't shift under students mid-use. Create a new assessment if you need changes."
  },
  {
    q: 'Can a student retake an assessment?',
    a: 'Not currently — one attempt per student per assessment.'
  },
  {
    q: 'Is student data safe?',
    a: "Submitted answer sheets go to Google's Gemini API for OCR and grading; everything else (accounts, scores, rubrics) lives in the platform's own database."
  }
];

export default function TeacherHelpPage() {
  const [openIndexes, setOpenIndexes] = useState<Record<number, boolean>>({});

  const toggleFAQ = (idx: number) => {
    setOpenIndexes((prev) => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  return (
    <ProtectedRoute allowedRole="teacher">
      <div className="flex flex-col lg:flex-row min-h-screen bg-bg-base text-text-primary font-sans w-full max-w-[100vw] overflow-x-hidden">
        <TeacherSidebar />

        <div className="flex-1 flex flex-col min-h-screen relative min-w-0 max-w-full overflow-x-hidden">
          {/* Background Warm Orange Glow Orbs */}
          <div className="absolute top-[10%] left-[30%] w-[36rem] h-[36rem] bg-orange-600/10 rounded-full blur-[160px] pointer-events-none" />
          <div className="absolute bottom-[5%] right-[10%] w-[30rem] h-[30rem] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />

          <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto pb-24 sm:pb-28 lg:pb-10 max-w-5xl w-full mx-auto space-y-6 lg:space-y-8 relative z-10 min-w-0 max-w-full box-border overflow-x-hidden">
            
            {/* Header with Breadcrumb */}
            <div className="space-y-1.5">
              <div className="text-[10px] sm:text-[11px] font-mono tracking-widest text-orange-500 uppercase font-semibold">
                TEACHER DASHBOARD &rsaquo; HELP CENTER
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                User Guide &amp; FAQs
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400">
                Watch our platform guide or browse frequently asked questions below.
              </p>
            </div>

            {/* Embedded YouTube Tutorial Video Player */}
            <div className="space-y-3 w-full box-border">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-orange-500" />
                  <span>Teacher Tutorial &amp; Platform Walkthrough</span>
                </h2>
                <span className="text-[10px] font-mono text-neutral-500 uppercase">Video Guide</span>
              </div>

              <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black box-border">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/cQyZ6rZoz1A"
                  title="EvalAssist Tutorial Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            {/* FAQs Section */}
            <div className="space-y-4 pt-2 w-full box-border">
              <div className="flex items-center gap-2.5 text-white font-bold text-base">
                <BookOpen className="w-4 h-4 text-orange-500" />
                <h2>Frequently Asked Questions</h2>
              </div>

              {/* 10 Expandable Accordions */}
              <div className="space-y-2.5 w-full box-border">
                {TEACHER_FAQS.map((faq, idx) => {
                  const isOpen = Boolean(openIndexes[idx]);
                  return (
                    <div
                      key={idx}
                      className={`border rounded-2xl transition-all overflow-hidden backdrop-blur-xl w-full box-border ${
                        isOpen
                          ? 'border-orange-500/40 bg-neutral-900/80 shadow-lg shadow-orange-600/10'
                          : 'border-white/10 bg-neutral-900/60 hover:border-white/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFAQ(idx)}
                        className="w-full p-4 md:p-5 text-left flex items-center justify-between gap-4 select-none cursor-pointer group box-border"
                      >
                        <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-orange-400 transition-colors break-words flex-1">
                          {faq.q}
                        </span>
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${
                            isOpen
                              ? 'rotate-180 bg-orange-600 text-white'
                              : 'bg-neutral-800 text-neutral-400 group-hover:text-white'
                          }`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-neutral-300 leading-relaxed border-t border-white/10 animate-fade-in box-border">
                          <p className="pt-2 font-normal leading-relaxed break-words">
                            {faq.a}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Support Card */}
            <div className="backdrop-blur-xl bg-neutral-900/60 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl w-full box-border">
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center text-orange-400">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h3 className="text-sm md:text-base font-bold text-white">
                  Need technical support or want to reach the development team?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
                  Have feedback, found a bug, or need account assistance? Contact the EvalAssist engineering team.
                </p>
                <div className="flex items-center gap-2 pt-1 text-xs font-mono text-orange-400">
                  <Mail className="w-3.5 h-3.5" />
                  <span>support@evalassist.pk</span>
                </div>
              </div>

              <a
                href="mailto:support@evalassist.pk"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-full text-xs transition-all shadow-lg shadow-orange-600/30 flex-shrink-0"
              >
                <span>Email Development Team</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
