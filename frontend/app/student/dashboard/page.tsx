'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import StudentSidebar from '@/components/StudentSidebar';
import BilingualBlock from '@/components/BilingualBlock';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Flame,
  Star,
  FileCheck,
  Clock,
  ArrowRight,
  TrendingUp,
  Loader2,
  Sparkles,
  BookOpen
} from 'lucide-react';

export default function StudentDashboard() {
  const { user, setQuickJoinOpen } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.getStudentDashboardSummary();
        setData(res);
      } catch (err) {
        console.error('Error fetching student dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);



  return (
    <ProtectedRoute allowedRole="student">
      <div className="flex flex-col lg:flex-row min-h-screen bg-bg-base">
        <StudentSidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 sm:pb-28 lg:pb-8 max-w-7xl w-full mx-auto space-y-6 lg:space-y-8 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : (
            <>
              {/* Welcome Header + Day Streak + Bilingual Quote Block */}
              <div className="bg-bg-surface border border-border rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-8 shadow-xl space-y-5 sm:space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary flex items-center gap-2">
                      <span>Welcome back, {user?.name?.split(' ')[0] || 'Student'}</span>
                      <span>👋</span>
                    </h1>
                    {data?.streak_days > 0 ? (
                      <div className="flex items-center gap-2 mt-1.5 text-accent text-sm font-semibold">
                        <Flame className="w-4 h-4 fill-accent" />
                        <span>You&apos;re on a {data.streak_days}-day learning streak. Keep up the momentum!</span>
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary mt-1.5">Complete your first assessment to start your streak!</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 bg-bg-surface-2 border border-border px-4 py-2 rounded-2xl">
                    <div className="w-8 h-8 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center text-xs">
                      {user?.name?.charAt(0) || 'E'}
                    </div>
                    <div className="text-left">
                      <span className="block text-[10px] text-accent uppercase font-bold tracking-wider">Student</span>
                      <span className="text-xs font-semibold text-text-primary">{user?.name || 'Student'}</span>
                    </div>
                  </div>
                </div>

                {/* Bilingual Motivational Quote Card */}
                <div className="bg-bg-base/70 border border-border/80 rounded-2xl p-5 shadow-inner">
                  <BilingualBlock
                    englishText={
                      data?.daily_quote?.quote_en ||
                      '"Education is the most powerful weapon which you can use to change the world"'
                    }
                    urduText={
                      data?.daily_quote?.quote_ur ||
                      '”تعلیم وہ سب سے طاقتور ہتھیار ہے جسے آپ دنیا بدلنے کے لیے استعمال کر سکتے ہیں“'
                    }
                    englishClassName="italic text-text-secondary text-sm"
                    urduClassName="text-accent text-lg"
                  />
                </div>
              </div>

              {/* 3 Metric Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Average Score */}
                <div className="bg-bg-surface border border-border rounded-2xl p-6 flex items-center justify-between shadow-lg">
                  <div>
                    <span className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                      Average Score
                    </span>
                    <span className="text-4xl font-bold text-text-primary font-mono">
                      {data?.average_score != null && data?.completed_assessments > 0 ? `${data.average_score}%` : '—'}
                    </span>
                    {(!data?.completed_assessments || data?.completed_assessments === 0) && (
                      <span className="block text-xs text-text-secondary mt-1">No finalized scores yet</span>
                    )}
                  </div>
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90 score-ring-glow">
                      <circle
                        cx="32"
                        cy="32"
                        r="24"
                        stroke="#202636"
                        strokeWidth="5"
                        fill="transparent"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="24"
                        stroke="#FF6B4A"
                        strokeWidth="5"
                        strokeDasharray="150"
                        strokeDashoffset={150 - (150 * (data?.average_score || 0)) / 100}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                  </div>
                </div>

                {/* 2. Completed Assessments */}
                <div className="bg-bg-surface border border-border rounded-2xl p-6 flex items-center justify-between shadow-lg">
                  <div>
                    <span className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                      Completed Assessments
                    </span>
                    <span className="text-4xl font-bold text-text-primary font-mono">
                      {data?.completed_assessments ?? 0}
                    </span>
                    {(data?.pending_this_week ?? 0) > 0 && (
                      <span className="block text-xs text-accent mt-1">
                        • {data.pending_this_week} pending this week
                      </span>
                    )}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-status-mastered/15 border border-status-mastered/30 flex items-center justify-center text-status-mastered">
                    <FileCheck className="w-6 h-6" />
                  </div>
                </div>

                {/* 3. Current Status */}
                <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between shadow-lg">
                  <span className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Current Status
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-accent/15 border border-accent/40 text-accent font-bold text-sm rounded-full shadow-glow-accent">
                      <Star className="w-4 h-4 fill-accent" />
                      <span>{data?.current_status || 'No assessments yet'}</span>
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-2">
                    {data?.cohort_ranking || 'Complete your assessments to see your standing.'}
                  </p>
                </div>
              </div>

              {/* Performance Trends Chart with Subject Row */}
              <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-6 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-text-primary">Performance Trends</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Subject-wise Performance based on Finalized Scores</p>
                  </div>

                  {/* Subject filter pills */}
                  {data?.subject_trends && Object.keys(data.subject_trends).length > 0 && (
                    <div className="flex items-center gap-1.5 bg-bg-surface-2 p-1 rounded-xl border border-border flex-wrap">
                      {Object.keys(data.subject_trends).map((sub) => (
                        <button
                          key={sub}
                          onClick={() => setSelectedSubject(sub)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            selectedSubject === sub
                              ? 'bg-accent text-bg-base shadow-glow-accent'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {sub === 'All' ? 'All Subjects' : sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dynamic Line Chart / Empty State */}
                {(!data?.completed_assessments || data?.completed_assessments === 0) ? (
                  <div className="h-44 w-full bg-bg-base/70 rounded-xl p-5 border border-border/70 flex flex-col items-center justify-center gap-2 text-text-secondary">
                    <TrendingUp className="w-8 h-8 text-text-secondary/40" />
                    <p className="text-xs">No performance trend data yet.</p>
                    <p className="text-[11px] text-text-secondary/60">Complete assessments to see your progress curve.</p>
                  </div>
                ) : (
                  <div className="relative h-60 w-full bg-bg-base/70 rounded-xl p-5 border border-border/70 flex flex-col justify-between overflow-visible">
                    {(() => {
                      const trendScores: number[] = data?.subject_trends?.[selectedSubject] || data?.subject_trends?.['All'] || [data?.average_score || 0];
                      const testDetails: any[] = data?.test_details || [];
                      const w = 480;
                      const h = 130;
                      const pad = 30;
                      const count = trendScores.length;
                      const points = trendScores.map((score: number, i: number) => {
                        const x = count === 1 ? w / 2 : pad + (i / (count - 1)) * (w - 2 * pad);
                        const y = h - (Math.min(100, Math.max(0, score)) / 100) * (h - 20) - 10;
                        const detail = testDetails[i] || { label: 'Assessment', subject: selectedSubject };
                        return { x, y, score, label: detail.label, subject: detail.subject || selectedSubject };
                      });

                      const pathD = points.length === 1
                        ? `M ${points[0].x - 40} ${points[0].y} L ${points[0].x + 40} ${points[0].y}`
                        : points.reduce((acc: string, pt: any, i: number) => (
                            i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
                          ), '');

                      const areaD = points.length === 1
                        ? `M ${points[0].x - 40} ${points[0].y} L ${points[0].x + 40} ${points[0].y} L ${points[0].x + 40} ${h} L ${points[0].x - 40} ${h} Z`
                        : `${pathD} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;

                      return (
                        <svg className="w-full h-40 overflow-visible my-auto" viewBox={`0 0 ${w} ${h}`}>
                          <defs>
                            <linearGradient id="studentGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#FF6B4A" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#FF6B4A" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d={areaD} fill="url(#studentGradient)" />
                          <path d={pathD} fill="transparent" stroke="#FF6B4A" strokeWidth="3" strokeLinecap="round" />
                          {points.map((pt: any, idx: number) => {
                            const isHovered = hoveredTrendIndex === idx;
                            return (
                              <g
                                key={idx}
                                className="cursor-pointer transition-all"
                                onMouseEnter={() => setHoveredTrendIndex(idx)}
                                onMouseLeave={() => setHoveredTrendIndex(null)}
                              >
                                {/* Hit target area */}
                                <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />
                                {/* Hover highlight ring (static, no animation) */}
                                {isHovered && (
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r="10"
                                    fill="none"
                                    stroke="#FF6B4A"
                                    strokeWidth="1.5"
                                    opacity="0.4"
                                  />
                                )}
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={isHovered ? 6 : 4.5}
                                  fill={isHovered ? '#FFFFFF' : '#FF6B4A'}
                                  stroke="#FF6B4A"
                                  strokeWidth={isHovered ? 2.5 : 2}
                                  className="transition-all duration-150"
                                />
                                {/* Percentage label above dot (when not hovered) */}
                                {!isHovered && (
                                  <text x={pt.x} y={pt.y - 10} textAnchor="middle" fill="#FF6B4A" fontSize="10" fontFamily="monospace" fontWeight="bold">
                                    {pt.score}%
                                  </text>
                                )}
                                {/* Tooltip on hover - shows Percentage, Test Name, Subject */}
                                {isHovered && (
                                  <g transform={`translate(${Math.max(70, Math.min(w - 70, pt.x))}, ${pt.y - 55})`}>
                                    <rect
                                      x="-65"
                                      y="-16"
                                      width="130"
                                      height="50"
                                      rx="8"
                                      fill="#0F141C"
                                      stroke="#FF6B4A"
                                      strokeWidth="1.5"
                                      filter="drop-shadow(0 4px 12px rgba(0,0,0,0.5))"
                                    />
                                    <polygon
                                      points="-5,34 5,34 0,39"
                                      fill="#0F141C"
                                    />
                                    {/* Percentage - prominently at top */}
                                    <text
                                      x="0"
                                      y="0"
                                      textAnchor="middle"
                                      fill="#FF6B4A"
                                      fontSize="13"
                                      fontFamily="monospace"
                                      fontWeight="bold"
                                    >
                                      {pt.score}%
                                    </text>
                                    {/* Test Name */}
                                    <text
                                      x="0"
                                      y="13"
                                      textAnchor="middle"
                                      fill="#FFFFFF"
                                      fontSize="8.5"
                                      fontWeight="bold"
                                    >
                                      {pt.label && pt.label.length > 20 ? pt.label.substring(0, 18) + '...' : pt.label}
                                    </text>
                                    {/* Subject */}
                                    <text
                                      x="0"
                                      y="25"
                                      textAnchor="middle"
                                      fill="#A0AEC0"
                                      fontSize="8"
                                    >
                                      {pt.subject}
                                    </text>
                                  </g>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}

                    <div className="flex justify-between text-[11px] font-mono text-text-secondary z-10">
                      <span>Timeline Progression ({selectedSubject === 'All' ? 'All Subjects' : selectedSubject})</span>
                      <span>Current: {data?.average_score != null ? `${data.average_score}%` : '—'}</span>
                    </div>
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
