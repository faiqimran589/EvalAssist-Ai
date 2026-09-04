'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Sparkles, KeyRound, ArrowRight, User, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function JoinTokenPage() {
  const params = useParams();
  const router = useRouter();
  const tokenParam = (params.token as string)?.toUpperCase();
  const { user, registerStudentToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  useEffect(() => {
    if (!tokenParam) return;

    const resolve = async () => {
      try {
        const res = await api.resolveToken(tokenParam);
        if (res.valid) {
          setAssessmentData(res);
          if (user && user.role === 'student') {
            router.push(`/student/assessments/${res.assessment_id}/take`);
          }
        } else {
          setError(res.message || 'Invalid assessment token.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to resolve token.');
      } finally {
        setLoading(false);
      }
    };

    resolve();
  }, [tokenParam, user, router]);

  const handleStudentSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !tokenParam) return;

    setSignupLoading(true);
    try {
      await registerStudentToken(name, email, password, tokenParam);
      if (assessmentData?.assessment_id) {
        router.push(`/student/assessments/${assessmentData.assessment_id}/take`);
      } else {
        router.push('/student/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Enrollment failed.');
    } finally {
      setSignupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 py-3 w-full max-w-full overflow-x-hidden box-border relative">
      <div className="w-full max-w-md backdrop-blur-xl bg-neutral-900/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 sm:space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center mx-auto text-orange-500 shadow-lg shadow-orange-600/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {assessmentData ? assessmentData.assessment_title : 'Join Assessment'}
          </h1>
          {assessmentData && (
            <p className="text-xs text-neutral-400">
              {assessmentData.subject} • Joining{' '}
              <span className="text-orange-400 font-semibold">{assessmentData.teacher_name}</span>'s class
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 text-red-300 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {user ? (
          <div className="space-y-4">
            <p className="text-xs text-neutral-400">
              Logged in as <span className="font-semibold text-white">{user.name}</span> ({user.email})
            </p>
            <button
              type="button"
              onClick={() => router.push(`/student/assessments/${assessmentData?.assessment_id}/take`)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 sm:py-3.5 rounded-xl shadow-lg shadow-orange-600/30 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>Enter Assessment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleStudentSignup} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 font-mono">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3 sm:top-3.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ahmed Ali"
                  className="w-full bg-neutral-950 border border-white/10 focus:border-orange-500 text-white pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 font-mono">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3 sm:top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full bg-neutral-950 border border-white/10 focus:border-orange-500 text-white pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 font-mono">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3 sm:top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-950 border border-white/10 focus:border-orange-500 text-white pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={signupLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 sm:py-3.5 rounded-xl shadow-lg shadow-orange-600/30 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98 mt-2"
            >
              {signupLoading ? 'Enrolling...' : 'Join Class & Start Test'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
