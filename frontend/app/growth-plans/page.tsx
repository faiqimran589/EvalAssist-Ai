'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import TeacherSidebar from '@/components/TeacherSidebar';
import { api } from '@/lib/api';
import { TrendingUp, Sparkles, BookOpen, Target, ArrowRight, Loader2, CheckCircle2, Lock, Rocket } from 'lucide-react';

export default function GrowthPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  return (
    <ProtectedRoute allowedRole="teacher">
      <div className="flex flex-col lg:flex-row min-h-screen bg-bg-base">
        <TeacherSidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 sm:pb-28 lg:pb-8 max-w-7xl w-full mx-auto space-y-6 lg:space-y-8 relative min-w-0">
          {/* Header */}
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">
              Personalized Student Growth Plans
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              AI-driven diagnostic paths, adaptive revision schedules, and personalized remediation.
            </p>
          </div>

          {/* Relative Container with Blurred Background and Coming Soon Overlay */}
          <div className="relative min-h-[500px] rounded-2xl overflow-hidden">
            {/* Blurred Mock Layout in Background */}
            <div className="filter blur-md opacity-30 select-none pointer-events-none grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
              {[1, 2].map((idx) => (
                <div
                  key={idx}
                  className="bg-bg-surface border border-border rounded-2xl p-6 space-y-5 shadow-lg"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">
                          Science & Mathematics
                        </span>
                        <h3 className="text-lg font-bold text-text-primary mt-0.5">
                          Student Growth Track
                        </h3>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-bg-surface-2 border border-border text-text-secondary">
                        Active Plan
                      </span>
                    </div>

                    <div className="p-3 bg-bg-base/80 rounded-xl border border-border">
                      <span className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                        Target Concept
                      </span>
                      <span className="text-xs font-semibold text-text-primary">
                        Conceptual Mastery & Problem Solving
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-text-secondary">Current: 70%</span>
                        <span className="text-accent font-bold">Target: 95%</span>
                      </div>
                      <div className="w-full bg-bg-surface-2 h-2 rounded-full overflow-hidden">
                        <div style={{ width: '70%' }} className="bg-accent h-full rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Foreground "Coming Soon" Modal / Card */}
            <div className="absolute inset-0 flex items-center justify-center p-6 z-10">
              <div className="bg-bg-surface/95 border border-accent/40 backdrop-blur-xl rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl space-y-5 animate-fade-in border-gradient">
                <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center mx-auto shadow-glow-accent">
                  <Rocket className="w-8 h-8 stroke-[2.2]" />
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/15 border border-accent/30 text-accent rounded-full text-[11px] font-bold uppercase tracking-widest font-mono">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Under Active Development</span>
                  </div>
                  <h2 className="text-2xl font-bold text-text-primary">Growth Plans — Coming Soon</h2>
                  <p className="text-xs text-text-secondary leading-relaxed max-w-md mx-auto">
                    We are engineering advanced AI tutoring models to automatically build personalized remediation roadmaps, targeted concept drills, and adaptive revision schedules based directly on verified student evaluations.
                  </p>
                </div>

                <div className="pt-2">
                  <span className="text-[11px] font-mono text-text-secondary bg-bg-surface-2 px-4 py-2 rounded-xl border border-border inline-block">
                    Stay tuned • Launching in the next release
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
