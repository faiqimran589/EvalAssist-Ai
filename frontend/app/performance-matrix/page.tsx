'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import TeacherSidebar from '@/components/TeacherSidebar';
import { api } from '@/lib/api';
import { LineChart, Search, Sparkles, Filter, Loader2 } from 'lucide-react';

export default function PerformanceMatrixPage() {
  const [matrixData, setMatrixData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchMatrix = async () => {
      try {
        const data = await api.getPerformanceMatrix();
        setMatrixData(data);
      } catch (err) {
        console.error('Error fetching performance matrix:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatrix();
  }, []);

  const dynamicTopics = Array.from(
    new Set(matrixData.flatMap((r) => Object.keys(r.test_marks || r.topic_mastery || {})))
  );

  const getScorePill = (marksStr: string, pctScore: number) => {
    if (!marksStr || marksStr.startsWith('—')) {
      return (
        <span className="inline-block px-3 py-1 bg-bg-surface-2 border border-border text-text-secondary font-mono rounded-lg text-xs">
          {marksStr || '—'}
        </span>
      );
    }
    if (pctScore >= 80) {
      return (
        <span className="inline-block px-3 py-1 bg-status-highConfidence/15 border border-status-highConfidence/30 text-status-highConfidence font-mono font-bold rounded-lg text-xs">
          {marksStr}
        </span>
      );
    }
    if (pctScore >= 60) {
      return (
        <span className="inline-block px-3 py-1 bg-accent/15 border border-accent/30 text-accent font-mono font-bold rounded-lg text-xs">
          {marksStr}
        </span>
      );
    }
    return (
      <span className="inline-block px-3 py-1 bg-status-attention/15 border border-status-attention/30 text-status-attention font-mono font-bold rounded-lg text-xs">
        {marksStr}
      </span>
    );
  };

  const filteredRows = matrixData.filter((r) =>
    r.student_name.toLowerCase().includes(search.toLowerCase())
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
                Class Performance Matrix
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">
                Multi-dimensional mastery analysis across assessments showing raw marks per test and overall percentage derived from finalized scores.
              </p>
            </div>

            {/* Search */}
            {matrixData.length > 0 && (
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-text-secondary absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter students..."
                  className="w-full bg-bg-surface border border-border focus:border-accent text-text-primary pl-10 pr-4 py-2.5 rounded-xl text-xs outline-none"
                />
              </div>
            )}
          </div>

          {/* Matrix Table */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center space-y-3">
              <LineChart className="w-10 h-10 text-text-secondary/40 mx-auto" />
              <h3 className="text-base font-bold text-text-primary">No performance matrix data yet</h3>
              <p className="text-xs text-text-secondary">
                The performance matrix will automatically compute and populate as student submissions are finalized.
              </p>
            </div>
          ) : (
            <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-surface-2 text-text-secondary uppercase font-bold border-b border-border text-[11px] tracking-wider">
                    <tr>
                      <th className="py-4 px-6">Student Name</th>
                      {dynamicTopics.map((t) => (
                        <th key={t} className="py-4 px-4 text-center">
                          {t}
                        </th>
                      ))}
                      <th className="py-4 px-6 text-center">Overall (%)</th>
                      <th className="py-4 px-6 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-primary font-medium">
                    {filteredRows.map((row) => (
                      <tr key={row.student_id} className="hover:bg-bg-surface-2/40 transition-colors">
                        <td className="py-4 px-6 font-bold text-text-primary">
                          {row.student_name}
                        </td>
                        {dynamicTopics.map((t) => {
                          const marksStr = row.test_marks?.[t] ?? `${row.topic_mastery?.[t] ?? 0}%`;
                          const pct = row.topic_mastery?.[t] ?? 0;
                          return (
                            <td key={t} className="py-4 px-4 text-center">
                              {getScorePill(marksStr, pct)}
                            </td>
                          );
                        })}
                        <td className="py-4 px-6 text-center font-mono font-bold text-sm text-accent">
                          {row.overall_avg}%
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                              row.status === 'excelling'
                                ? 'bg-status-highConfidence/20 text-status-highConfidence border border-status-highConfidence/40'
                                : row.status === 'stable'
                                ? 'bg-accent/20 text-accent border border-accent/40'
                                : 'bg-status-attention/20 text-status-attention border border-status-attention/40'
                            }`}
                          >
                            {row.status}
                          </span>
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
