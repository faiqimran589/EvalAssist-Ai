'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import TeacherSidebar from '@/components/TeacherSidebar';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  BookOpen,
  PlusCircle,
  Search,
  Clock,
  Award,
  Share2,
  CheckCircle2,
  FileText,
  Loader2,
  ExternalLink,
  UserCheck
} from 'lucide-react';

export default function TeacherAssessmentsPage() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAssessments = async () => {
    try {
      const data = await api.listAssessments();
      setAssessments(data);
    } catch (err) {
      console.error('Error fetching assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const filteredAssessments = assessments.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.subject.toLowerCase().includes(search.toLowerCase()) ||
      a.share_token.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRole="teacher">
      <div className="flex flex-col lg:flex-row min-h-screen bg-bg-base">
        <TeacherSidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 sm:pb-28 lg:pb-8 max-w-7xl w-full mx-auto space-y-6 lg:space-y-8 min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">
                My Created Assessments
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">
                Manage your assessments, rubric configurations, and student access tokens.
              </p>
            </div>

            <Link
              href="/assessments/new"
              className="bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 glow-btn transition-all self-start sm:self-auto shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Assessment</span>
            </Link>
          </div>

          {/* Filter / Search Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-text-secondary absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assessments, subjects, or tokens..."
                className="w-full bg-bg-surface border border-border focus:border-accent text-text-primary pl-10 pr-4 py-2.5 rounded-xl text-xs outline-none transition-colors"
              />
            </div>
            <span className="text-xs font-mono text-text-secondary">
              Total Assessments: {assessments.length}
            </span>
          </div>

          {/* Assessments Grid / List */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center space-y-4">
              <BookOpen className="w-12 h-12 text-text-secondary/40 mx-auto" />
              <h3 className="text-base font-bold text-text-primary">No assessments created yet</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                Create your first test or diagnostic exam to generate a share token for your students.
              </p>
              <Link
                href="/assessments/new"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-bold py-2.5 px-5 rounded-xl text-xs glow-btn transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Assessment</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssessments.map((item) => {
                const isCreator = item.teacher_id === user?.id || item.teacher_name === user?.name;

                return (
                  <div
                    key={item.id}
                    className="bg-bg-surface border border-border hover:border-border-hover rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-card transition-all"
                  >
                    <div className="space-y-3">
                      {/* Subject & Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-accent uppercase font-mono tracking-wider">
                          {item.subject}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono border ${
                            item.status === 'published'
                              ? 'bg-status-highConfidence/15 border-status-highConfidence/30 text-status-highConfidence'
                              : 'bg-status-needsReview/15 border-status-needsReview/30 text-status-needsReview'
                          }`}
                        >
                          {item.status === 'published' ? '● Published' : '○ Draft'}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-bold text-text-primary leading-snug">
                        {item.title}
                      </h3>

                      {/* Creator Info */}
                      <div className="flex items-center gap-2 text-xs text-text-secondary pt-1 border-t border-border/50">
                        <UserCheck className="w-3.5 h-3.5 text-accent" />
                        <span>
                          Created by:{' '}
                          <strong className="text-text-primary">
                            {isCreator ? `${user?.name || 'You'} (You)` : item.teacher_name}
                          </strong>
                        </span>
                      </div>

                      {/* Metrics: Marks, Duration, Questions */}
                      <div className="grid grid-cols-3 gap-2 bg-bg-base/70 p-3 rounded-xl border border-border/70 text-center font-mono">
                        <div>
                          <span className="block text-[10px] text-text-secondary uppercase">Marks</span>
                          <span className="text-xs font-bold text-text-primary">{item.total_marks}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-text-secondary uppercase">Time</span>
                          <span className="text-xs font-bold text-text-primary">{item.duration_minutes}m</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-text-secondary uppercase">Questions</span>
                          <span className="text-xs font-bold text-text-primary">{item.questions?.length || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Share Token & Action */}
                    <div className="pt-3 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-1.5 bg-bg-surface-2 px-3 py-1.5 rounded-lg border border-border">
                        <span className="text-[10px] text-text-secondary font-mono">Code:</span>
                        <span className="text-xs font-bold font-mono text-accent">{item.share_token}</span>
                      </div>

                      <Link
                        href={`/submissions?assessment_id=${item.id}`}
                        className="text-xs font-semibold text-text-secondary hover:text-text-primary hover:underline flex items-center gap-1"
                      >
                        <span>View Submissions</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
