'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import TeacherSidebar from '@/components/TeacherSidebar';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import { api } from '@/lib/api';
import {
  FileText,
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Loader2,
  ExternalLink,
  ShieldAlert,
  Timer
} from 'lucide-react';

export default function TeacherSubmissionsPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [activeAttempts, setActiveAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [graceMinutes, setGraceMinutes] = useState<Record<string, number>>({});

  const fetchData = async () => {
    try {
      const [subsData, attemptsData] = await Promise.all([
        api.listTeacherSubmissions(),
        api.listActiveAttempts(),
      ]);
      setSubmissions(subsData);
      setActiveAttempts(attemptsData);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePublishGrades = async (submissionId: string) => {
    try {
      await api.publishSubmissionGrades(submissionId);
      fetchData();
    } catch (err: any) {
      alert(`Failed to publish grades: ${err.message}`);
    }
  };

  const handleExtendTime = async (attemptId: string) => {
    const minutes = graceMinutes[attemptId] || 15;
    if (minutes <= 0 || isNaN(minutes)) {
      alert('Please enter a valid number of minutes greater than 0.');
      return;
    }
    setExtendingId(attemptId);
    try {
      await api.extendAttempt(attemptId, minutes);
      alert(`Added ${minutes} minute${minutes !== 1 ? 's' : ''} to student attempt successfully.`);
      setGraceMinutes((prev) => ({ ...prev, [attemptId]: 0 }));
      fetchData();
    } catch (err: any) {
      alert(`Failed to extend time: ${err.message}`);
    } finally {
      setExtendingId(null);
    }
  };

  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch =
      sub.student_name.toLowerCase().includes(search.toLowerCase()) ||
      sub.assessment_title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filterStatus === 'all' || sub.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <ProtectedRoute allowedRole="teacher">
      <div className="flex flex-col lg:flex-row min-h-screen bg-bg-base">
        <TeacherSidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 sm:pb-28 lg:pb-8 max-w-7xl w-full mx-auto space-y-6 lg:space-y-8 min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">
                Student Submissions
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">
                Review automated AI grades, override marks, and publish feedback to students.
              </p>
            </div>
          </div>

          {/* Active Attempts Monitor Card (if any active students) */}
          {activeAttempts.length > 0 && (
            <div className="bg-bg-surface border border-accent/30 rounded-2xl p-6 shadow-glow-accent space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-accent animate-pulse" />
                  <h3 className="text-sm font-bold text-text-primary">
                    Live Exam Sessions In Progress ({activeAttempts.length})
                  </h3>
                </div>
                <span className="text-xs text-text-secondary">Real-time attempt security monitoring</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeAttempts.map((att) => (
                  <div
                    key={att.attempt_id}
                    className="bg-bg-surface-2 border border-border rounded-xl p-4 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-text-primary">{att.student_name}</span>
                        {att.blur_events_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-status-attention bg-status-attention/15 border border-status-attention/30 px-2 py-0.5 rounded-full font-mono">
                            <ShieldAlert className="w-3 h-3" />
                            <span>{att.blur_events_count} Tab Exit(s) Detected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-status-highConfidence bg-status-highConfidence/10 border border-status-highConfidence/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Session Normal</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text-secondary">{att.assessment_title}</span>
                    </div>

                    {att.blur_events_count > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Timer className="w-3.5 h-3.5 text-accent absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="number"
                              min="1"
                              max="120"
                              value={graceMinutes[att.attempt_id] ?? ''}
                              onChange={(e) => setGraceMinutes((prev) => ({ ...prev, [att.attempt_id]: Number(e.target.value) }))}
                              placeholder="Minutes"
                              className="w-full bg-bg-base border border-border focus:border-accent text-text-primary pl-8 pr-2 py-2 rounded-lg text-xs font-mono font-bold outline-none text-center"
                            />
                          </div>
                          <button
                            onClick={() => handleExtendTime(att.attempt_id)}
                            disabled={extendingId === att.attempt_id}
                            className="flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg-base font-bold border border-accent/40 text-xs py-2 px-3 rounded-lg transition-all shadow-md whitespace-nowrap"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{extendingId === att.attempt_id ? 'Adding...' : 'Grant Grace'}</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-text-secondary text-center">
                          Enter custom grace minutes for this student
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-2 px-3 bg-bg-base/60 border border-border/60 rounded-lg text-[11px] text-text-secondary">
                        No interruption detected (Grace locked)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-text-secondary absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student or assessment..."
                className="w-full bg-bg-surface border border-border focus:border-accent text-text-primary pl-10 pr-4 py-2.5 rounded-xl text-xs outline-none transition-colors"
              />
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-2 bg-bg-surface p-1 rounded-xl border border-border text-xs font-semibold">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  filterStatus === 'all' ? 'bg-accent text-bg-base' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                All Submissions
              </button>
              <button
                onClick={() => setFilterStatus('needs_review')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  filterStatus === 'needs_review' ? 'bg-status-needsReview text-bg-base' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Needs Review
              </button>
              <button
                onClick={() => setFilterStatus('published')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  filterStatus === 'published' ? 'bg-status-highConfidence text-bg-base' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Published
              </button>
            </div>
          </div>

          {/* Submissions Table / Cards */}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-text-secondary/40 mx-auto" />
              <h3 className="text-base font-bold text-text-primary">No submissions found</h3>
              <p className="text-xs text-text-secondary">
                Students will appear here once they complete and submit their assessments.
              </p>
            </div>
          ) : (
            <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-surface-2 text-text-secondary uppercase font-bold border-b border-border text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-6">Student</th>
                      <th className="py-3.5 px-6">Assessment</th>
                      <th className="py-3.5 px-6 text-center">Score</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-primary font-medium">
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-bg-surface-2/40 transition-colors">
                        <td className="py-4 px-6 font-bold">{sub.student_name}</td>
                        <td className="py-4 px-6">
                          <span className="font-semibold">{sub.assessment_title}</span>
                          <span className="block text-[11px] text-text-secondary">{sub.subject}</span>
                        </td>
                        <td className="py-4 px-6 text-center font-mono font-bold text-sm">
                          {sub.overall_score} / {sub.total_marks}
                          <span className="block text-[10px] text-text-secondary font-sans font-normal">
                            {Math.round((sub.overall_score / sub.total_marks) * 100)}%
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {sub.status === 'published' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-status-highConfidence font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Published</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-status-needsReview font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Under Review</span>
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {sub.status === 'needs_review' && (
                              <button
                                onClick={() => handlePublishGrades(sub.id)}
                                className="bg-status-highConfidence/15 hover:bg-status-highConfidence text-status-highConfidence hover:text-bg-base border border-status-highConfidence/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Publish Grades
                              </button>
                            )}
                            <Link
                              href={`/submissions/${sub.id}`}
                              className="bg-bg-surface-2 hover:bg-accent text-text-primary hover:text-bg-base border border-border px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                            >
                              <span>Inspect</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
