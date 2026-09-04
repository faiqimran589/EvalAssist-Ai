'use client';

import React, { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import StudentSidebar from '@/components/StudentSidebar';
import {
  ChevronDown,
  Play,
  Mail,
  ArrowRight,
  HelpCircle,
  Sparkles,
  MessageSquare
} from 'lucide-react';

interface FAQ {
  q: string;
  a: string;
}

const STUDENT_FAQS: FAQ[] = [
  {
    q: 'How do I create an account?',
    a: "You can't sign up on your own — ask your teacher for their join token or link. Opening it lets you create an account and automatically joins their class."
  },
  {
    q: 'What do I submit, and how?',
    a: 'On the Assessment Portal, do your work, then upload a single PDF or clear photo (under 15MB) via drag-and-drop or "Submit Work" before time runs out.'
  },
  {
    q: 'Can I take the same test more than once?',
    a: 'No — one attempt per assessment.'
  },
  {
    q: 'Can I refresh the page to get more time?',
    a: "No — the timer runs on the server, not your browser. If you have a real connection problem, tell your teacher; they can add time from their side."
  },
  {
    q: 'Can I leave the assessment tab during the exam?',
    a: "It's tracked — navigating away is logged, so stay on the page."
  },
  {
    q: 'What if my internet connection drops or the electricity goes out during the exam?',
    a: "Don't panic — as soon as you're back online, tell your teacher. They can add extra time to your attempt from their portal to make up for what you lost. You can't reset your own timer, so reaching out to your teacher is the only way to recover that time."
  },
  {
    q: 'How is my work graded?',
    a: "Against your teacher's rubric — you get marks per question, what you got right, what was missed, and a specific improvement tip."
  },
  {
    q: "What's the difference between 'High Confidence' and 'Under Teacher Review'?",
    a: "High Confidence means the grading is final. Under Teacher Review means the AI flagged something uncertain, so your teacher checks it before it's locked in — the score might still shift slightly."
  },
  {
    q: 'Can I see exactly where I lost marks?',
    a: 'Yes — "View Detailed Feedback" shows your original answer with highlights over what earned credit and what was flagged.'
  },
  {
    q: 'What is "My Learning Path"?',
    a: 'A personalized plan built from your weak spots — your current focus area, a short revision plan, and practice modules.'
  }
];

export default function StudentHelpPage() {
  const [openIndexes, setOpenIndexes] = useState<Record<number, boolean>>({});

  const toggleFAQ = (idx: number) => {
    setOpenIndexes((prev) => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  return (
    <ProtectedRoute allowedRole="student">
      <div className="flex flex-col lg:flex-row min-h-screen bg-bg-base text-text-primary font-sans w-full max-w-[100vw] overflow-x-hidden">
        <StudentSidebar />

        <div className="flex-1 flex flex-col min-h-screen relative min-w-0 max-w-full overflow-x-hidden">
          {/* Background Warm Orange Glow Orbs */}
          <div className="absolute top-[10%] left-[30%] w-[36rem] h-[36rem] bg-orange-600/10 rounded-full blur-[160px] pointer-events-none" />
          <div className="absolute bottom-[5%] right-[10%] w-[30rem] h-[30rem] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />

          <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto pb-24 sm:pb-28 lg:pb-10 max-w-5xl w-full mx-auto space-y-6 lg:space-y-8 relative z-10 min-w-0 max-w-full box-border overflow-x-hidden">
            
            {/* Header with Breadcrumb */}
            <div className="space-y-1.5">
              <div className="text-[10px] sm:text-[11px] font-mono tracking-widest text-orange-500 uppercase font-semibold">
                STUDENT DASHBOARD &rsaquo; HELP CENTER
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                User Guide &amp; FAQs
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400">
                Watch our student guide or browse frequently asked questions below.
              </p>
            </div>

            {/* Embedded YouTube Tutorial Video Player */}
            <div className="space-y-3 w-full box-border">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-orange-500" />
                  <span>Student Tutorial &amp; Platform Walkthrough</span>
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
                <HelpCircle className="w-4 h-4 text-orange-500" />
                <h2>Frequently Asked Questions</h2>
              </div>

              {/* 10 Expandable Accordions */}
              <div className="space-y-2.5 w-full box-border">
                {STUDENT_FAQS.map((faq, idx) => {
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
                  Need technical support?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
                  Have feedback or need account assistance? Contact the EvalAssist engineering team.
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
