'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  FileCheck,
  TrendingUp,
  KeyRound,
  HelpCircle,
  LogOut,
  Sparkles,
  Settings,
  GraduationCap,
} from 'lucide-react';

export default function StudentSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, setQuickJoinOpen } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleLogout = () => {
    setProfileMenuOpen(false);
    logout();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Submissions', href: '/student/submissions', icon: FileCheck },
    { label: 'Learning Path', href: '/student/learning-path', icon: TrendingUp },
  ];

  const mobileTabs = [
    { label: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Submissions', href: '/student/submissions', icon: FileCheck },
    { label: 'Learning Path', href: '/student/learning-path', icon: TrendingUp },
    { label: 'Help Center', href: '/student/help', icon: HelpCircle },
  ];

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
              <span className="text-[10px] text-accent font-mono tracking-wide block truncate">Student Portal</span>
            </div>
          </div>

          {/* Join Assessment CTA */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <button
              onClick={() => setQuickJoinOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-3 rounded-xl glow-btn text-xs tracking-wide transition-all shadow-md active:scale-[0.98]"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Join Assessment</span>
            </button>
          </div>

          {/* Navigation Links (Compact & Streamlined) */}
          <nav className="px-2.5 py-1 space-y-1 flex-1 overflow-hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/student/dashboard' && pathname.startsWith(`${item.href}`));
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
            href="/student/help"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              pathname === '/student/help'
                ? 'sidebar-active text-accent font-semibold bg-accent/10 border border-accent/20 shadow-[0_0_12px_rgba(255,107,74,0.15)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface2'
            }`}
          >
            <HelpCircle className={`w-4 h-4 flex-shrink-0 ${pathname === '/student/help' ? 'text-accent' : ''}`} />
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
        <Link href="/student/dashboard" className="flex items-center gap-2.5">
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
            <span className="text-[9px] text-accent font-mono tracking-wider uppercase font-semibold">Student</span>
          </div>
        </Link>

        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            onClick={() => setQuickJoinOpen(true)}
            className="flex items-center gap-1 bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-[11px] font-semibold px-2.5 py-1 rounded-xl transition-all"
          >
            <KeyRound className="w-3 h-3" />
            <span>Join</span>
          </button>
          <Link
            href="/student/help"
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
            {user?.name?.charAt(0) || 'S'}
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
                      {user?.name?.charAt(0) || 'S'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{user?.name || 'Student'}</p>
                      <p className="text-neutral-400 text-[10px] truncate">{user?.email || ''}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3 text-accent" />
                    <span className="text-[10px] text-accent font-semibold uppercase tracking-wider">Student</span>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-1.5">
                  <Link
                    href="/student/settings"
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
          {/* Absolute Centered Floating Orange Action Button: JOIN ASSESSMENT */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-5 z-20 flex flex-col items-center pointer-events-auto">
            <button
              type="button"
              onClick={() => setQuickJoinOpen(true)}
              className="w-12 h-12 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/40 ring-4 ring-neutral-950 flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              aria-label="Join Assessment"
            >
              <KeyRound className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* 5-Column Grid with Center Spacer */}
          <div className="grid grid-cols-5 items-center justify-items-center">
            
            {/* Tab 1: Dashboard */}
            <Link
              href="/student/dashboard"
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative w-full ${
                pathname === '/student/dashboard'
                  ? 'text-orange-500 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-lg ${pathname === '/student/dashboard' ? 'bg-orange-500/15 shadow-[0_0_12px_rgba(226,88,34,0.3)]' : ''}`}>
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Dashboard</span>
              {pathname === '/student/dashboard' && (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(226,88,34,0.8)]" />
              )}
            </Link>

            {/* Tab 2: Submissions */}
            <Link
              href="/student/submissions"
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative w-full ${
                pathname.startsWith('/student/submissions')
                  ? 'text-orange-500 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-lg ${pathname.startsWith('/student/submissions') ? 'bg-orange-500/15 shadow-[0_0_12px_rgba(226,88,34,0.3)]' : ''}`}>
                <FileCheck className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Submissions</span>
              {pathname.startsWith('/student/submissions') && (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(226,88,34,0.8)]" />
              )}
            </Link>

            {/* Center Label Spacer Column */}
            <div className="flex flex-col items-center justify-end h-full pb-0.5 pointer-events-none">
              <span className="text-[9px] font-extrabold text-orange-500 tracking-tight uppercase mt-6">
                Join
              </span>
            </div>

            {/* Tab 4: Learning Path */}
            <Link
              href="/student/learning-path"
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative w-full ${
                pathname.startsWith('/student/learning-path')
                  ? 'text-orange-500 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-lg ${pathname.startsWith('/student/learning-path') ? 'bg-orange-500/15 shadow-[0_0_12px_rgba(226,88,34,0.3)]' : ''}`}>
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Path</span>
              {pathname.startsWith('/student/learning-path') && (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(226,88,34,0.8)]" />
              )}
            </Link>

            {/* Tab 5: Help Center */}
            <Link
              href="/student/help"
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative w-full ${
                pathname.startsWith('/student/help')
                  ? 'text-orange-500 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-lg ${pathname.startsWith('/student/help') ? 'bg-orange-500/15 shadow-[0_0_12px_rgba(226,88,34,0.3)]' : ''}`}>
                <HelpCircle className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Help</span>
              {pathname.startsWith('/student/help') && (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(226,88,34,0.8)]" />
              )}
            </Link>

          </div>
        </div>
      </nav>
    </>
  );
}
