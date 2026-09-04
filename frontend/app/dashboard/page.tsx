'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import TeacherSidebar from '@/components/TeacherSidebar';
import {
  Check,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  Loader2,
  BarChart2,
  Lightbulb,
  Search,
} from 'lucide-react';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly'>('weekly');
  const [studentSearch, setStudentSearch] = useState('');
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const data = await api.getPerformanceOverview();
        setStats(data);
      } catch (err) {
        console.error('Error loading performance overview:', err);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  const overallScore = stats?.overall_class_score ?? 0;
  const aiFeedbackAccuracy = stats?.ai_feedback_accuracy ?? 0;
  const studentGrowth = stats?.student_growth_pct ?? 0;
  const enrolledStudents: any[] = stats?.enrolled_students ?? [];
  const trends = (timeRange === 'weekly' ? stats?.weekly_trends : stats?.monthly_trends) ?? [];

  const filteredStudents = enrolledStudents.filter((s: any) =>
    s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const noData = !stats || (stats.total_submissions === 0 && enrolledStudents.length === 0);

  return (
    <ProtectedRoute allowedRole="teacher">
      <div className="flex flex-col lg:flex-row min-h-screen bg-bg-base">
        <TeacherSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header Bar (Desktop only, mobile has TeacherSidebar top bar) */}
          <header className="hidden lg:flex bg-bg-surface border-b border-border px-8 py-3.5 items-center justify-between flex-shrink-0">
            <div>
              <span className="text-xs font-bold text-accent tracking-wider uppercase">Dashboard Overview</span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-text-secondary px-3 py-1 bg-bg-surface2 rounded-full border border-border">
                Teacher Mode
              </span>
              <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-bold text-xs">
                {user?.name?.charAt(0) || 'P'}
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 sm:pb-28 lg:pb-8 max-w-7xl w-full mx-auto max-w-full overflow-x-hidden">
            {/* Page Title */}
            <div className="mb-6 lg:mb-8">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">
                Welcome back, {user?.name || 'Professor'}
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">
                Here is a summary of your classes&apos; performance today.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
              </div>
            ) : (
              <div className="space-y-8">
                {/* 3 Metric Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* 1. Overall Class Score */}
                  <div className="bg-bg-surface border border-border rounded-2xl p-6 flex items-center justify-between shadow-card hover:border-border-hover transition-colors">
                    <div>
                      <span className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-3">
                        Overall Class Score
                      </span>
                      <span className="text-4xl font-bold text-text-primary font-mono">
                        {noData ? '—' : `${overallScore}%`}
                      </span>
                      {noData && <span className="block text-xs text-text-secondary mt-1">No finalized scores yet</span>}
                    </div>
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <svg className="w-16 h-16 transform -rotate-90 score-ring-glow">
                        <circle cx="32" cy="32" r="24" stroke="#202636" strokeWidth="5" fill="transparent" />
                        <circle
                          cx="32" cy="32" r="24"
                          stroke="#FF6B4A"
                          strokeWidth="5"
                          strokeDasharray="150"
                          strokeDashoffset={150 - (150 * (noData ? 0 : overallScore)) / 100}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* 2. AI Feedback Accuracy */}
                  <div className="bg-bg-surface border border-border rounded-2xl p-6 flex items-center justify-between shadow-card hover:border-border-hover transition-colors">
                    <div>
                      <span className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-3">
                        AI Feedback Accuracy
                      </span>
                      <span className="text-4xl font-bold text-text-primary font-mono">
                        {noData ? '—' : `${aiFeedbackAccuracy}%`}
                      </span>
                      {noData && <span className="block text-xs text-text-secondary mt-1">No submissions yet</span>}
                    </div>
                    <div className="w-14 h-14 rounded-full bg-status-mastered/15 border border-status-mastered/30 flex items-center justify-center text-status-mastered shadow-glow-cyan">
                      <Check className="w-6 h-6 stroke-[2.5]" />
                    </div>
                  </div>

                  {/* 3. Student Growth */}
                  <div className="bg-bg-surface border border-border rounded-2xl p-6 flex items-center justify-between shadow-card hover:border-border-hover transition-colors">
                    <div>
                      <span className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-3">
                        Student Growth
                      </span>
                      <span className="text-4xl font-bold font-mono text-status-highConfidence">
                        {noData ? '—' : `+${studentGrowth}%`}
                      </span>
                      {noData && <span className="block text-xs text-text-secondary mt-1">No comparative data yet</span>}
                    </div>
                    <div className="w-14 h-14 rounded-full bg-status-highConfidence/15 border border-status-highConfidence/30 flex items-center justify-center text-status-highConfidence shadow-glow-green">
                      <TrendingUp className="w-6 h-6 stroke-[2.5]" />
                    </div>
                  </div>
                </div>

                {/* Performance Trends Chart */}
                <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col shadow-card">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-base font-bold text-text-primary">Performance Trends</h3>
                      <p className="text-xs text-text-secondary mt-0.5">Average student scores across assessments over time</p>
                    </div>
                    <span className="text-xs font-mono text-text-secondary">Based on Finalized Scores</span>
                  </div>

                  {noData || trends.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-bg-base/50 rounded-xl border border-border/50 min-h-[200px] p-6">
                      <BarChart2 className="w-10 h-10 text-text-secondary/40" />
                      <p className="text-sm text-text-secondary">No submission data to display yet.</p>
                      <p className="text-xs text-text-secondary/60">Create an assessment and have students submit to see trends.</p>
                    </div>
                  ) : (
                    <div className="relative h-64 w-full bg-bg-base/60 rounded-xl p-4 border border-border/60 flex flex-col justify-center overflow-visible">
                      {/* Dynamic SVG Wave / Line Path with Interactive Hover Tooltip */}
                      {(() => {
                        const w = 540;
                        const h = 140;
                        const pad = 40;
                        const count = trends.length;
                        const points = trends.map((t: any, i: number) => {
                          const x = count === 1 ? w / 2 : pad + (i / (count - 1)) * (w - 2 * pad);
                          const y = h - (Math.min(100, Math.max(0, t.score)) / 100) * (h - 40) - 20;
                          return { x, y, score: t.score, label: t.label, subject: t.subject || 'General', index: i };
                        });

                        const pathD = points.length === 1
                          ? `M ${points[0].x - 50} ${points[0].y} L ${points[0].x + 50} ${points[0].y}`
                          : points.reduce((acc: string, pt: any, i: number) => (
                              i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
                            ), '');

                        const areaD = points.length === 1
                          ? `M ${points[0].x - 50} ${points[0].y} L ${points[0].x + 50} ${points[0].y} L ${points[0].x + 50} ${h} L ${points[0].x - 50} ${h} Z`
                          : `${pathD} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;

                        return (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <svg className="w-full h-48 overflow-visible" viewBox={`0 0 ${w} ${h}`}>
                              <defs>
                                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#FF6B4A" stopOpacity="0.35" />
                                  <stop offset="100%" stopColor="#FF6B4A" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              <path d={areaD} fill="url(#curveGradient)" />
                              <path d={pathD} fill="transparent" stroke="#FF6B4A" strokeWidth="3" strokeLinecap="round" />
                              
                              {/* Grid guidelines */}
                              <line x1="0" y1={h - 20} x2={w} y2={h - 20} stroke="#202636" strokeDasharray="3 3" strokeWidth="1" />
                              <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#202636" strokeDasharray="3 3" strokeWidth="1" />

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

                                    {/* Percentage label always visible above each point */}
                                    <text
                                      x={pt.x}
                                      y={pt.y - 14}
                                      textAnchor="middle"
                                      fill="#FF6B4A"
                                      fontSize="11"
                                      fontFamily="monospace"
                                      fontWeight="bold"
                                      className="pointer-events-none"
                                    >
                                      {pt.score}%
                                    </text>

                                    {/* Tooltip on hover - shows Test Name, Subject */}
                                    {isHovered && (
                                      <g transform={`translate(${Math.max(75, Math.min(w - 75, pt.x))}, ${pt.y - 65})`}>
                                        <rect
                                          x="-70"
                                          y="-18"
                                          width="140"
                                          height="42"
                                          rx="8"
                                          fill="#0F141C"
                                          stroke="#FF6B4A"
                                          strokeWidth="1.5"
                                          filter="drop-shadow(0 4px 12px rgba(0,0,0,0.5))"
                                        />
                                        <polygon
                                          points="-5,24 5,24 0,29"
                                          fill="#0F141C"
                                        />
                                        {/* Test Name */}
                                        <text
                                          x="0"
                                          y="-2"
                                          textAnchor="middle"
                                          fill="#FFFFFF"
                                          fontSize="9.5"
                                          fontWeight="bold"
                                        >
                                          {pt.label.length > 22 ? pt.label.substring(0, 20) + '...' : pt.label}
                                        </text>
                                        {/* Subject */}
                                        <text
                                          x="0"
                                          y="12"
                                          textAnchor="middle"
                                          fill="#A0AEC0"
                                          fontSize="8.5"
                                        >
                                          {pt.subject}
                                        </text>
                                      </g>
                                    )}
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Enrolled Students Section Under Performance Trends */}
                <div className="bg-bg-surface border border-border rounded-2xl p-6 space-y-5 shadow-card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-text-primary">Enrolled Students</h3>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Students who joined through your assessment tokens or registered into your classes
                      </p>
                    </div>

                    {/* Search filter box with Dark Sleek Background & Neon Orange styling */}
                    <div className="relative w-full md:w-72">
                      <Search className="w-4 h-4 text-accent absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search student name or email..."
                        className="w-full bg-[#0F141C] border border-accent/40 focus:border-accent text-accent placeholder:text-accent/60 pl-9 pr-4 py-2 rounded-xl text-xs outline-none transition-all shadow-[0_0_12px_rgba(255,107,74,0.15)] focus:shadow-[0_0_18px_rgba(255,107,74,0.35)]"
                      />
                    </div>
                  </div>

                  {filteredStudents.length === 0 ? (
                    <div className="bg-bg-base/50 border border-border/50 rounded-xl p-8 text-center space-y-2">
                      <p className="text-xs text-text-secondary">
                        {studentSearch ? 'No students match your search filter.' : 'No students have joined via your assessment tokens yet.'}
                      </p>
                      <p className="text-[11px] text-text-secondary/60">
                        Share your assessment token with students to enroll them.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-bg-surface-2 text-text-secondary uppercase font-bold border-b border-border text-[11px] tracking-wider">
                            <tr>
                              <th className="py-3.5 px-5">Student Name</th>
                              <th className="py-3.5 px-5">Student Email</th>
                              <th className="py-3.5 px-5">Password</th>
                              <th className="py-3.5 px-5 text-center">Submissions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-text-primary font-medium">
                            {filteredStudents.map((s: any) => (
                              <tr key={s.id} className="hover:bg-bg-surface-2/40 transition-colors">
                                <td className="py-3.5 px-5 font-bold">{s.name}</td>
                                <td className="py-3.5 px-5 text-text-secondary font-mono text-[11px]">{s.email}</td>
                                <td className="py-3.5 px-5">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-mono bg-bg-base border border-accent/30 text-accent font-semibold tracking-wider select-all cursor-text">
                                    {s.plain_password || 'student123'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-5 text-center font-mono font-bold text-accent">
                                  {s.submissions_count ?? 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
