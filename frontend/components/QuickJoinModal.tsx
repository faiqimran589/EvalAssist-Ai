'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { X, KeyRound, Sparkles, User, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

export default function QuickJoinModal() {
  const { quickJoinOpen, setQuickJoinOpen, user, registerStudentToken } = useAuth();
  const router = useRouter();

  const [tokenInput, setTokenInput] = useState('');
  const [resolvedData, setResolvedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Minimal signup state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  if (!quickJoinOpen) return null;

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setError('');
    setLoading(true);
    try {
      const res = await api.resolveToken(tokenInput.trim());
      if (!res.valid) {
        setError(res.message || 'Invalid assessment token. Please check with your teacher.');
      } else {
        setResolvedData(res);
        if (user && user.role === 'student') {
          // Already logged in as student -> route to take assessment
          setQuickJoinOpen(false);
          router.push(`/student/assessments/${res.assessment_id}/take`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resolve token.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !resolvedData) return;

    setError('');
    setSignupLoading(true);
    try {
      await registerStudentToken(name, email, password, tokenInput.trim());
      setQuickJoinOpen(false);
      router.push(`/student/assessments/${resolvedData.assessment_id}/take`);
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleClose = () => {
    setQuickJoinOpen(false);
    setResolvedData(null);
    setError('');
    setTokenInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-surface border border-border w-full max-w-md rounded-2xl p-6 relative shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-bg-surface-2 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!resolvedData ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">Quick Join Assessment</h2>
                <p className="text-xs text-text-secondary">Enter the short test token provided by your instructor</p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-status-attention/15 border border-status-attention/30 text-status-attention rounded-xl text-xs mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  Test Token
                </label>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="e.g. AB-123"
                  className="w-full bg-bg-base border border-border focus:border-accent text-text-primary px-4 py-3 rounded-xl font-mono text-center text-lg tracking-widest outline-none transition-colors"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !tokenInput.trim()}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg-base font-semibold py-3 rounded-xl glow-btn transition-all text-sm"
              >
                {loading ? 'Verifying Token...' : 'Find Assessment'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-4 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-status-highConfidence/15 border border-status-highConfidence/30 text-status-highConfidence rounded-full text-xs font-medium mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Token Verified</span>
              </div>
              <h2 className="text-base font-bold text-text-primary">{resolvedData.assessment_title}</h2>
              <p className="text-xs text-text-secondary">
                {resolvedData.subject} • Joining <span className="text-accent font-medium">{resolvedData.teacher_name}</span>'s class
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-status-attention/15 border border-status-attention/30 text-status-attention rounded-xl text-xs mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {user ? (
              <div className="space-y-4">
                <div className="bg-bg-surface-2 p-3.5 rounded-xl text-xs text-text-secondary border border-border">
                  You are logged in as <span className="font-semibold text-text-primary">{user.name}</span> ({user.role}).
                </div>
                <button
                  onClick={() => {
                    setQuickJoinOpen(false);
                    router.push(`/student/assessments/${resolvedData.assessment_id}/take`);
                  }}
                  className="w-full bg-accent hover:bg-accent-hover text-bg-base font-semibold py-3 rounded-xl glow-btn transition-all text-sm flex items-center justify-center gap-2"
                >
                  <span>Start Assessment Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleStudentSignup} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-text-secondary absolute left-3 top-3" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full bg-bg-base border border-border focus:border-accent text-text-primary pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-text-secondary absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      className="w-full bg-bg-base border border-border focus:border-accent text-text-primary pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Create Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-secondary absolute left-3 top-3" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-bg-base border border-border focus:border-accent text-text-primary pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={signupLoading}
                  className="w-full bg-accent hover:bg-accent-hover text-bg-base font-semibold py-3 rounded-xl glow-btn transition-all text-sm flex items-center justify-center gap-2 mt-2"
                >
                  {signupLoading ? 'Creating Account & Enrolling...' : 'Join Class & Enter Test'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
