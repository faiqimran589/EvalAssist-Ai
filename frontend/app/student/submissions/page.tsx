'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import StudentSidebar from '@/components/StudentSidebar';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import { api } from '@/lib/api';
import {
  Inbox,
  Search,
  ArrowRight,
  Sparkles,
  Award,
  BookOpen,
  Loader2,
  Calendar,
  Lightbulb
} from 'lucide-react';

export default function StudentSubmissionsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await api.getStudentSubmissions();
        setData(res);
      } catch (err) {
        console.error('Error fetching student submissions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, []);

  const filteredSubmissions =
    data?.submissions?.filter((s: any) =>
      s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.subject?.toLowerCase().includes(search.toLowerCase())
    ) || [];

  return (
    <ProtectedRoute allowedRole="student">
      <div className="flex flex-col lg:flex-row min-h-screen bg-bg-base">
        <StudentSidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 sm:pb-28 lg:pb-8 max-w-7xl w-full mx-auto space-y-6 lg:space-y-8 min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">
                My Submissions
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">
                Review your graded assessments, AI Tutor feedback, and handwritten paper analysis.
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-text-secondary absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assessments..."
                className="w-full bg-bg-surface border border-border focus:border-accent text-text-primary pl-10 pr-4 py-2.5 rounded-xl text-xs outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : (
            <>
              {/* Performance Overview Banner */}
              <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1 max-w-xl">
                  <h3 className="text-xs font-bold text-accent uppercase tracking-wider">
                    Performance Overview
                  </h3>
                  <p className="text-xs text-text-primary leading-relaxed">
                    <strong className="text-text-secondary">Summary:</strong>{' '}
                    {data?.overview?.ai_strength_summary ||
                      'Complete assessments to view your overall score and strength breakdown.'}
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="bg-bg-surface-2 px-4 py-2 rounded-xl border border-border text-center">
                    <span className="block text-[10px] font-bold text-text-secondary uppercase">
                      Total Assessments
                    </span>
                    <span className="text-xl font-bold text-text-primary font-mono">
                      {data?.overview?.total_assessments || 0}
                    </span>
                  </div>

                  <div className="bg-bg-surface-2 px-4 py-2 rounded-xl border border-border text-center">
                    <span className="block text-[10px] font-bold text-text-secondary uppercase">
                      Average Score
                    </span>
                    <span className="text-xl font-bold text-accent font-mono">
                      {data?.overview?.average_score ? `${data.overview.average_score}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submissions Grid */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-text-primary">Recent Submissions</h3>

                {filteredSubmissions.length === 0 ? (
                  <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center text-text-secondary">
                    No submissions found. Join an assessment with a share token to submit your answer sheet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSubmissions.map((sub: any) => {
                      const isPublished = sub.status === 'published';

                      return (
                        <div
                          key={sub.id}
                          className="bg-bg-surface border border-border hover:border-accent/50 rounded-2xl p-6 flex flex-col justify-between space-y-5 transition-all shadow-lg group"
                        >
                          <div className="space-y-4">
                            {/* Header: Subject + Score Ring */}
                            <div className="flex items-start justify-between">
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-bg-surface-2 text-text-secondary border border-border font-mono">
                                {sub.subject}
                              </span>
                              <div className="w-12 h-12 rounded-full border-2 border-accent/60 bg-accent/10 flex items-center justify-center text-xs font-bold font-mono text-accent">
                                {isPublished ? `${sub.score_pct}%` : '—'}
                              </div>
                            </div>

                            {/* Title & Date */}
                            <div>
                              <h4 className="text-base font-bold text-text-primary group-hover:text-accent transition-colors">
                                {sub.title}
                              </h4>
                              <span className="flex items-center gap-1 text-[11px] text-text-secondary mt-1">
                                <Calendar className="w-3 h-3" />
                                <span>{sub.date}</span>
                              </span>
                            </div>

                            {/* Key Takeaway */}
                            <div className="bg-bg-base/70 border border-border/80 rounded-xl p-3 text-xs text-text-secondary flex items-start gap-2">
                              <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                              <p className="line-clamp-2 leading-relaxed">{sub.key_takeaway}</p>
                            </div>

                            <ConfidenceBadge
                              status={sub.status}
                              scorePct={isPublished ? sub.score_pct : undefined}
                            />
                          </div>

                          <Link
                            href={`/student/submissions/${sub.id}`}
                            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-bold py-2.5 rounded-xl glow-btn transition-all text-xs"
                          >
                            <span>{isPublished ? 'View Official Results' : 'View Status'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
