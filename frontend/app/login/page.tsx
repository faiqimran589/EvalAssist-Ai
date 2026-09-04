'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Image from 'next/image';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  CheckCircle2,
  BookOpen,
  Users,
  ShieldCheck,
  Zap,
  GraduationCap,
  Sparkles,
  BarChart2,
  Activity,
  Target,
  LineChart
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, registerTeacher } = useAuth();

  const [roleTab, setRoleTab] = useState<'student' | 'teacher'>('student');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [quickToken, setQuickToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (roleTab === 'teacher' && isRegisterMode) {
        await registerTeacher(name, email, password);
      } else {
        await login(email, password, roleTab);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickToken.trim()) return;

    try {
      const res = await api.resolveToken(quickToken.trim());
      if (!res.valid) {
        setError(res.message || 'Invalid assessment token.');
      } else {
        router.push(`/join/${quickToken.trim().toUpperCase()}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resolve token.');
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col justify-between relative overflow-x-hidden font-sans">
      {/* Background Warm Orange Glow Orbs */}
      <div className="absolute top-[10%] left-[20%] -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-orange-600/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[15%] translate-x-1/4 translate-y-1/4 w-[36rem] h-[36rem] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[50%] left-[50%] -translate-x-1/2 w-[28rem] h-[28rem] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* ========================================================================= */}
      {/* 1. TOP HEADER NAVIGATION BAR */}
      {/* ========================================================================= */}
      <header className="w-full backdrop-blur-xl bg-neutral-950/80 border-b border-white/10 sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-center p-1.5 shadow-md flex-shrink-0">
            <Image
              src="/logo.png"
              alt="EvalAssist Logo"
              width={32}
              height={32}
              className="rounded-lg object-contain drop-shadow-[0_0_8px_rgba(226,88,34,0.45)]"
              priority
            />
          </div>
          <div>
            <span className="text-base font-extrabold text-white tracking-tight">EvalAssist</span>
            <span className="hidden sm:inline-block text-[10px] text-orange-500 font-mono tracking-wider ml-2 font-semibold uppercase">
              AI Assessment
            </span>
          </div>
        </div>

        {/* Top-Right Header Pill Login Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLoginModalOpen(true)}
            className="rounded-full bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 shadow-lg shadow-orange-600/30 font-medium text-xs sm:text-sm tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <User className="w-3.5 h-3.5" />
            <span>Login / Register</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. LANDING SHOWCASE MATCHING VISUAL REFERENCE */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col justify-center items-start px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl mx-auto w-full relative z-10 space-y-6 my-auto">

        {/* Top Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/80 border border-white/10 text-neutral-400 text-[10px] sm:text-[11px] font-mono tracking-widest uppercase shadow-sm">
          <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
          <span>TRANSFORMING EDUCATION &bull; PAKISTAN</span>
        </div>

        {/* Hero Branding Header (Icon + Title + Subtitle) */}
        <div className="flex items-center gap-4 sm:gap-6 pt-1">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neutral-900/90 border border-white/10 shadow-2xl flex items-center justify-center p-3 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="EvalAssist Icon"
              width={56}
              height={56}
              className="object-contain drop-shadow-[0_0_12px_rgba(226,88,34,0.5)]"
              priority
            />
          </div>
          <div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-none">
              EvalAssist
            </h1>
            <p className="text-orange-500 font-semibold text-xs sm:text-base tracking-normal mt-1.5">
              AI-Powered Assessment &amp; Personalized Learning Platform
            </p>
          </div>
        </div>

        {/* Subtitle / Paragraph */}
        <p className="text-neutral-300 text-xs sm:text-sm lg:text-base leading-relaxed max-w-2xl">
          Turning every marked paper into a personalized learning experience.
          Empowering students with actionable feedback, mistake pattern detection, and targeted revision.
        </p>

        {/* 2x2 Glassy Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-2">
          {/* Card 1 */}
          <div className="backdrop-blur-xl bg-neutral-900/60 border border-white/10 shadow-2xl rounded-2xl p-5 sm:p-6 space-y-2.5 transition-all hover:border-orange-500/30">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-800/90 border border-white/10 text-orange-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                <BarChart2 className="w-5 h-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-mono font-bold text-white leading-snug">
                Detailed Per-Question Feedback
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed pl-13 sm:pl-14">
              Understand exactly where and why marks were deducted.
            </p>
          </div>

          {/* Card 2 */}
          <div className="backdrop-blur-xl bg-neutral-900/60 border border-white/10 shadow-2xl rounded-2xl p-5 sm:p-6 space-y-2.5 transition-all hover:border-orange-500/30">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-800/90 border border-white/10 text-cyan-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-mono font-bold text-white leading-snug">
                Mistake Pattern Detection
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed pl-13 sm:pl-14">
              Identify weak concepts down to specific sub-topics.
            </p>
          </div>

          {/* Card 3 */}
          <div className="backdrop-blur-xl bg-neutral-900/60 border border-white/10 shadow-2xl rounded-2xl p-5 sm:p-6 space-y-2.5 transition-all hover:border-orange-500/30">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-800/90 border border-white/10 text-neutral-300 flex items-center justify-center flex-shrink-0 shadow-inner">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-mono font-bold text-white leading-snug">
                Targeted Topic Suggestions
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed pl-13 sm:pl-14">
              Get specific, topic-by-topic recommendations based on your test mistakes.
            </p>
          </div>

          {/* Card 4 */}
          <div className="backdrop-blur-xl bg-neutral-900/60 border border-white/10 shadow-2xl rounded-2xl p-5 sm:p-6 space-y-2.5 transition-all hover:border-orange-500/30">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-800/90 border border-white/10 text-sky-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                <LineChart className="w-5 h-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-mono font-bold text-white leading-snug">
                Teacher &amp; Class Analytics
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed pl-13 sm:pl-14">
              Reduce grading workload and track student improvement over time.
            </p>
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div className="flex flex-wrap items-center justify-start gap-6 pt-2 text-[10px] sm:text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-orange-500" />
            <span>AI-DRIVEN RUBRIC EVALUATION</span>
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-orange-500" />
            <span>CONCEPT-LEVEL MAPPING</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-orange-500" />
            <span>BUILT FOR STUDENTS &amp; TEACHERS</span>
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-4 text-center text-xs text-neutral-500 font-mono">
        EvalAssist AI Platform &bull; Encrypted &amp; Secure Assessment Portal
      </footer>

      {/* ========================================================================= */}
      {/* 3. DESKTOP SPLIT LAYOUT & MOBILE FITTED GLASS MODAL LOGIN GATEWAY */}
      {/* ========================================================================= */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center lg:p-0 p-4 bg-black/80 backdrop-blur-2xl animate-fade-in h-screen w-screen overflow-hidden">

          {/* Main Gateway Shell: Split screen on lg: screens */}
          <div className="relative w-full h-full lg:flex flex-row overflow-hidden bg-neutral-950">

            {/* Close Button on Desktop & Mobile */}
            <button
              type="button"
              onClick={() => setLoginModalOpen(false)}
              className="absolute top-5 right-5 z-30 w-9 h-9 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close Login Portal"
            >
              ✕
            </button>

            {/* LEFT PANEL: Login Gateway Card */}
            <div className="w-full lg:w-1/2 h-full flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 bg-neutral-950/90 backdrop-blur-xl border-r border-white/10 overflow-y-auto">
              <div className="w-full max-w-md space-y-5 my-auto">

                {/* Brand Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-center p-2 shadow-md">
                    <Image
                      src="/logo.png"
                      alt="EvalAssist Logo"
                      width={32}
                      height={32}
                      className="object-contain drop-shadow-[0_0_8px_rgba(226,88,34,0.45)]"
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {roleTab === 'teacher' && isRegisterMode ? 'Teacher Registration' : 'EvalAssist Portal Sign In'}
                    </h2>
                    <p className="text-xs text-neutral-400">
                      {roleTab === 'teacher' && isRegisterMode
                        ? 'Create an instructor account to manage assessments'
                        : 'Access your personalized learning dashboard'}
                    </p>
                  </div>
                </div>

                {/* Role Switcher Pills */}
                <div className="flex p-1 bg-neutral-900 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleTab('student');
                      setIsRegisterMode(false);
                      setError('');
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${roleTab === 'student'
                        ? 'bg-orange-600 text-white shadow-md font-bold'
                        : 'text-neutral-400 hover:text-white'
                      }`}
                  >
                    Student Portal
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoleTab('teacher');
                      setError('');
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${roleTab === 'teacher'
                        ? 'bg-orange-600 text-white shadow-md font-bold'
                        : 'text-neutral-400 hover:text-white'
                      }`}
                  >
                    Teacher Portal
                  </button>
                </div>

                {/* If Teacher Portal is active: Show Register sub-switch */}
                {roleTab === 'teacher' && (
                  <div className="flex justify-center gap-4 text-xs border-b border-white/10 pb-3">
                    <button
                      type="button"
                      onClick={() => setIsRegisterMode(false)}
                      className={`font-semibold pb-1 border-b-2 transition-all cursor-pointer ${!isRegisterMode
                          ? 'border-orange-500 text-orange-400'
                          : 'border-transparent text-neutral-400 hover:text-white'
                        }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRegisterMode(true)}
                      className={`font-semibold pb-1 border-b-2 transition-all cursor-pointer ${isRegisterMode
                          ? 'border-orange-500 text-orange-400'
                          : 'border-transparent text-neutral-400 hover:text-white'
                        }`}
                    >
                      Register New Teacher
                    </button>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl text-center font-medium">
                    {error}
                  </div>
                )}

                {/* Sign In Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {roleTab === 'teacher' && isRegisterMode && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 font-mono">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Professor Tariq"
                          className="w-full bg-neutral-900 border border-white/10 focus:border-orange-500 text-white pl-10 pr-4 py-2.5 rounded-xl text-xs outline-none transition-colors"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 font-mono">
                      EMAIL
                    </label>
                    <div className="relative">
                      <GraduationCap className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={roleTab === 'student' ? 'student@school.edu.pk' : 'teacher@school.edu.pk'}
                        className="w-full bg-neutral-900 border border-white/10 focus:border-orange-500 text-white placeholder:text-neutral-600 pl-10 pr-4 py-2.5 rounded-xl text-xs outline-none transition-colors font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                        PASSWORD
                      </label>
                      <button
                        type="button"
                        onClick={() => alert('Please contact your teacher or administrator to reset credentials.')}
                        className="text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-neutral-900 border border-white/10 focus:border-orange-500 text-white pl-10 pr-10 py-2.5 rounded-xl text-xs outline-none transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-neutral-500 hover:text-white transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Glowing Warm Orange CTA Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 rounded-full shadow-lg shadow-orange-600/30 transition-all text-xs tracking-wide cursor-pointer mt-2 active:scale-[0.99]"
                  >
                    {loading ? (
                      <span>Authenticating...</span>
                    ) : (
                      <>
                        <span>
                          {roleTab === 'teacher' && isRegisterMode ? 'Register Teacher Account' : 'Enter Dashboard'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Create Account / Join prompt */}
                <div className="text-center text-xs text-neutral-400 pt-1">
                  <span>New to EvalAssist? </span>
                  {roleTab === 'teacher' ? (
                    <button
                      type="button"
                      onClick={() => setIsRegisterMode(!isRegisterMode)}
                      className="text-orange-400 font-semibold hover:underline cursor-pointer"
                    >
                      {isRegisterMode ? 'Sign In Instead' : 'Create an Account'}
                    </button>
                  ) : (
                    <span className="text-orange-400 font-semibold">
                      Create an Account (via Quick Join)
                    </span>
                  )}
                </div>

                {/* Quick Join Bottom Section */}
                <div className="pt-4 border-t border-white/10 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 font-mono">
                    <Zap className="w-3.5 h-3.5 text-orange-500" />
                    <span>Quick Join (For Students)</span>
                  </div>
                  <form onSubmit={handleQuickJoinSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={quickToken}
                      onChange={(e) => setQuickToken(e.target.value.toUpperCase())}
                      placeholder="ENTER TEST TOKEN (E.G. EX-992)"
                      className="flex-1 bg-neutral-900 border border-white/10 focus:border-orange-500 text-white px-3.5 py-2.5 rounded-xl text-xs font-mono tracking-wider outline-none placeholder:text-neutral-600 placeholder:font-mono"
                    />
                    <button
                      type="submit"
                      disabled={!quickToken.trim()}
                      className="bg-neutral-800 hover:bg-neutral-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Join
                    </button>
                  </form>
                </div>

              </div>
            </div>

            {/* RIGHT PANEL: Aesthetic Showcase Panel (Desktop Split View) */}
            <div className="hidden lg:flex lg:w-1/2 h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-orange-950/40 p-12 relative items-center justify-center overflow-hidden border-l border-white/5">
              {/* Background ambient lighting */}
              <div className="absolute -right-20 -top-20 w-96 h-96 bg-orange-600/15 rounded-full blur-[140px] pointer-events-none" />
              <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />

              <div className="relative z-10 max-w-lg space-y-8">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-white/10 text-orange-400 text-xs font-mono uppercase tracking-widest shadow-md">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  <span>AI Rubric Evaluation Engine</span>
                </div>

                {/* Heading & description */}
                <div className="space-y-3">
                  <h3 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
                    Smart Paper Grading &amp; Diagnostic Learning Path
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Designed specifically for matric and intermediate assessment curricula. Analyze handwritten student responses, detect mistake trends, and generate personalized remedial roadmaps.
                  </p>
                </div>

                {/* Feature Highlights Grid */}
                <div className="space-y-3.5 pt-2">
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-900/60 backdrop-blur-md border border-white/10 shadow-lg">
                    <div className="w-8 h-8 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-white">Urdu &amp; English Handwriting OCR</span>
                      <span className="text-[11px] text-neutral-400">Accurately digitizes scanned test papers</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-900/60 backdrop-blur-md border border-white/10 shadow-lg">
                    <div className="w-8 h-8 rounded-xl bg-cyan-400/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-white">Deep Concept-Level Gap Detection</span>
                      <span className="text-[11px] text-neutral-400">Pinpoints specific sub-topic deficiencies</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-900/60 backdrop-blur-md border border-white/10 shadow-lg">
                    <div className="w-8 h-8 rounded-xl bg-sky-400/20 text-sky-400 flex items-center justify-center flex-shrink-0">
                      <LineChart className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-white">Automated Remedial Growth Plans</span>
                      <span className="text-[11px] text-neutral-400">Generates adaptive revision roadmaps per student</span>
                    </div>
                  </div>
                </div>

                {/* Security Tag */}
                <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 pt-2">
                  <ShieldCheck className="w-4 h-4 text-orange-500" />
                  <span>FERPA &amp; GDPR Compliant Cloud Architecture</span>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
