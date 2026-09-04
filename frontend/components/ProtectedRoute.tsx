'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: 'teacher' | 'student';
}

export default function ProtectedRoute({
  children,
  allowedRole,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (allowedRole && user.role !== allowedRole) {
        // Redirect to their own dashboard
        if (user.role === 'teacher') {
          router.push('/dashboard');
        } else {
          router.push('/student/dashboard');
        }
      }
    }
  }, [user, loading, allowedRole, router]);

  if (loading || !user || (allowedRole && user.role !== allowedRole)) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-xs text-text-secondary">Securing workspace session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
