'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Grid3X3,
  TrendingUp,
  PlusCircle,
  HelpCircle,
  LogOut,
  MoreHorizontal,
  X,
  Plus,
  User,
  Settings,
  Shield
} from 'lucide-react';

export default function TeacherSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleLogout = () => {
    setProfileMenuOpen(false);
    logout();
    router.push('/login');
  };

  const desktopNavItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Assessments', href: '/assessments', icon: BookOpen },
    { label: 'Submissions', href: '/submissions', icon: FileText },
    { label: 'Performance Matrix', href: '/performance-matrix', icon: Grid3X3 },
    { label: 'Growth Plans', href: '/growth-plans', icon: TrendingUp },
  ];

  const mobilePrimaryTabs = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Assessments', href: '/assessments', icon: BookOpen },
    { label: 'Submissions', href: '/submissions', icon: FileText },
    { label: 'Analytics', href: '/performance-matrix', icon: Grid3X3 },
  ];

  const isMoreActive =
    pathname === '/growth-plans' ||
    pathname.startsWith('/growth-plans/') ||
    pathname === '/help' ||
    pathname.startsWith('/help/') ||
    pathname === '/assessments/new';

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP SIDEBAR (lg:flex, fixed/sticky h-screen locked, overflow-hidden) */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex flex-col justify-between w-60 xl:w-64 h-screen sticky top-0 bg-bg-surface border-r border-border flex-shrink-0 z-30 overflow-hidden select-none">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-bg-surface2/50 border border-border/50">
              <Image
                src="/logo.png"
                alt="EvalAssist Logo"
                width={30}
                height={30}
                className="rounded-lg object-contain drop-shadow-[0_0_8px_rgba(255,107,74,0.4)]"
                priority
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-text-primary text-sm leading-tight truncate">EvalAssist</h1>
              <span className="text-[10px] text-accent font-mono tracking-wide block truncate">Teacher Portal</span>
            </div>
          </div>

          {/* New Assessment CTA */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <Link
              href="/assessments/new"
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-3 rounded-xl glow-btn text-xs tracking-wide transition-all shadow-md active:scale-[0.98]"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Assessment</span>
            </Link>
          </div>

          {/* Navigation Links (Compact & Streamlined) */}
          <nav className="px-2.5 py-1 space-y-1 flex-1 overflow-hidden">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'sidebar-active text-accent font-semibold bg-accent/10 border border-accent/20 shadow-[0_0_12px_rgba(255,107,74,0.15)]'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface2'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-accent' : ''}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer / Help & Logout */}
        <div className="border-t border-border p-2.5 space-y-1 flex-shrink-0 bg-bg-surface">
          <Link
            href="/help"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              pathname === '/help'
                ? 'sidebar-active text-accent font-semibold bg-accent/10 border border-accent/20 shadow-[0_0_12px_rgba(255,107,74,0.15)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface2'
            }`}
          >
            <HelpCircle className={`w-4 h-4 flex-shrink-0 ${pathname === '/help' ? 'text-accent' : ''}`} />
            <span className="truncate">Help Center</span>
          </Link>

          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-status-attention/80 hover:text-status-attention hover:bg-status-attention/10 transition-all font-medium"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Logout</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE TOP HEADER (< 1024px / lg:hidden) */}
      {/* ========================================================================= */}
      <header className="lg:hidden sticky top-0 left-0 right-0 z-40 bg-bg-surface/90 backdrop-blur-md border-b border-border px-4 py-2.5 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-bg-surface2 border border-border/60">
            <Image
              src="/logo.png"
              alt="EvalAssist"
              width={22}
              height={22}
              className="rounded object-contain drop-shadow-[0_0_6px_rgba(255,107,74,0.5)]"
            />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-text-primary text-sm tracking-tight">EvalAssist</span>
            <span className="text-[9px] text-accent font-mono tracking-wider uppercase font-semibold">Teacher</span>
          </div>
        </Link>

        <div className="flex items-center gap-2 relative">
          <Link
            href="/assessments/new"
            className="flex items-center gap-1 bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-[11px] font-semibold px-2.5 py-1 rounded-xl transition-all"
          >
            <Plus className="w-3 h-3" />
            <span>Create</span>
          </Link>
          <Link
            href="/help"
            className="w-8 h-8 rounded-xl bg-bg-surface2 border border-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-all"
            aria-label="Help Center"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </Link>

          {/* Profile Avatar Button */}
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="w-7 h-7 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-bold text-[10px] hover:bg-accent/30 transition-all active:scale-95"
            aria-label="Profile menu"
          >
            {user?.name?.charAt(0) || 'T'}
          </button>

          {/* Profile Dropdown Menu */}
          {profileMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProfileMenuOpen(false)}
              />
              {/* Dropdown */}
              <div className="absolute right-0 top-9 z-50 w-56 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-bold text-xs flex-shrink-0">
                      {user?.name?.charAt(0) || 'T'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{user?.name || 'Teacher'}</p>
                      <p className="text-neutral-400 text-[10px] truncate">{user?.email || ''}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-accent" />
                    <span className="text-[10px] text-accent font-semibold uppercase tracking-wider">Teacher</span>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-1.5">
                  <Link
                    href="/settings"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/8 transition-all text-xs"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Settings</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-xs"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. MOBILE FIXED BOTTOM NAVIGATION BAR (< 1024px / lg:hidden) */}
      {/* ========================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-neutral-950/90 border-t border-white/10 px-2 py-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
        <div className="relative max-w-lg mx-auto">
          {/* Absolute Centered Floating Orange Action Button: CREATE ASSESSMENT */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-5 z-20 flex flex-col items-center pointer-events-auto">
            <Link
              href="/assessments/new"
              className="w-12 h-12 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/40 ring-4 ring-neutral-950 flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              aria-label="Create Assessment"
            >
              <Plus className="w-6 h-6 text-white stroke-[2.5]" />
            </Link>
          </div>

          {/* 5-Column Grid with Center Spacer */}
          <div className="grid grid-cols-5 items-center justify-items-center">
            
            {/* Tab 1: Dashboard */}
            <Link
              href="/dashboard"
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative w-full ${
                pathname === '/dashboard'
                  ? 'text-orange-500 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-lg ${pathname === '/dashboard' ? 'bg-orange-500/15 shadow-[0_0_12px_rgba(226,88,34,0.3)]' : ''}`}>
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Dashboard</span>
              {pathname === '/dashboard' && (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(226,88,34,0.8)]" />
              )}
            </Link>

            {/* Tab 2: Assessments */}
            <Link
              href="/assessments"
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative w-full ${
                pathname.startsWith('/assessments') && pathname !== '/assessments/new'
                  ? 'text-orange-500 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-lg ${pathname.startsWith('/assessments') && pathname !== '/assessments/new' ? 'bg-orange-500/15 shadow-[0_0_12px_rgba(226,88,34,0.3)]' : ''}`}>
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Tests</span>
              {pathname.startsWith('/assessments') && pathname !== '/assessments/new' && (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(226,88,34,0.8)]" />
              )}
            </Link>

            {/* Center Label Spacer Column */}
            <div className="flex flex-col items-center justify-end h-full pb-0.5 pointer-events-none">
              <span className="text-[9px] font-extrabold text-orange-500 tracking-tight uppercase mt-6">
                Create
              </span>
            </div>

            {/* Tab 4: Submissions */}
            <Link
              href="/submissions"
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative w-full ${
                pathname.startsWith('/submissions')
                  ? 'text-orange-500 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-lg ${pathname.startsWith('/submissions') ? 'bg-orange-500/15 shadow-[0_0_12px_rgba(226,88,34,0.3)]' : ''}`}>
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Submissions</span>
              {pathname.startsWith('/submissions') && (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(226,88,34,0.8)]" />
              )}
            </Link>

            {/* Tab 5: More */}
            <button
              type="button"
              onClick={() => setMoreDrawerOpen(true)}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative w-full ${
                isMoreActive
                  ? 'text-orange-500 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-lg ${isMoreActive ? 'bg-orange-500/15 shadow-[0_0_12px_rgba(226,88,34,0.3)]' : ''}`}>
                <MoreHorizontal className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">More</span>
              {isMoreActive && (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(226,88,34,0.8)]" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 4. MOBILE SLIDE-UP "MORE" DRAWER / BOTTOM SHEET (< 1024px) */}
      {/* ========================================================================= */}
      {moreDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end animate-fade-in">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMoreDrawerOpen(false)}
          />

          {/* Slide-Up Container */}
          <div className="relative backdrop-blur-xl bg-neutral-900/95 border-t border-white/10 rounded-t-3xl p-5 pb-8 shadow-2xl z-10 space-y-4 max-w-lg mx-auto w-full animate-slide-up">
            {/* Drawer Handle */}
            <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide uppercase font-mono">
                  Additional Navigation
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-600/20 text-orange-400 font-semibold border border-orange-500/30">
                  Teacher
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMoreDrawerOpen(false)}
                className="w-7 h-7 rounded-full bg-neutral-800 border border-white/5 flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/performance-matrix"
                onClick={() => setMoreDrawerOpen(false)}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  pathname === '/performance-matrix'
                    ? 'bg-orange-600/20 border-orange-500/40 text-orange-400 font-bold'
                    : 'bg-neutral-950/80 border-white/10 text-white hover:border-white/20'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center flex-shrink-0 text-orange-400">
                  <Grid3X3 className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-bold">Analytics Matrix</span>
                  <span className="text-[10px] text-neutral-400">Class Performance</span>
                </div>
              </Link>

              <Link
                href="/growth-plans"
                onClick={() => setMoreDrawerOpen(false)}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  pathname === '/growth-plans'
                    ? 'bg-orange-600/20 border-orange-500/40 text-orange-400 font-bold'
                    : 'bg-neutral-950/80 border-white/10 text-white hover:border-white/20'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center flex-shrink-0 text-orange-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-bold">Growth Plans</span>
                  <span className="text-[10px] text-neutral-400">Remedial Roadmaps</span>
                </div>
              </Link>

              <Link
                href="/help"
                onClick={() => setMoreDrawerOpen(false)}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  pathname === '/help'
                    ? 'bg-orange-600/20 border-orange-500/40 text-orange-400 font-bold'
                    : 'bg-neutral-950/80 border-white/10 text-white hover:border-white/20'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center flex-shrink-0 text-neutral-400">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-bold">Help Center</span>
                  <span className="text-[10px] text-neutral-400">Guide &amp; FAQs</span>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMoreDrawerOpen(false);
                  logout();
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-all text-left cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-bold">Logout</span>
                  <span className="text-[10px] text-red-300/80">Sign Out Portal</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
