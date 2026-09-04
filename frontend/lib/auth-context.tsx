'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, expectedRole?: string) => Promise<void>;
  registerTeacher: (name: string, email: string, password: string) => Promise<void>;
  registerStudentToken: (name: string, email: string, password: string, share_token: string) => Promise<void>;
  logout: () => void;
  quickJoinOpen: boolean;
  setQuickJoinOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickJoinOpen, setQuickJoinOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedToken = localStorage.getItem('evalassist_token');
    const savedUser = localStorage.getItem('evalassist_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('evalassist_token');
        localStorage.removeItem('evalassist_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, expectedRole?: string) => {
    const res = await api.login({ email, password, expected_role: expectedRole });
    const userData: User = {
      id: res.user_id,
      name: res.name,
      email: res.email,
      role: res.role,
    };
    setUser(userData);
    setToken(res.access_token);
    localStorage.setItem('evalassist_token', res.access_token);
    localStorage.setItem('evalassist_user', JSON.stringify(userData));

    if (userData.role === 'teacher') {
      router.push('/dashboard');
    } else {
      router.push('/student/dashboard');
    }
  };

  const registerTeacher = async (name: string, email: string, password: string) => {
    const res = await api.registerTeacher({ name, email, password });
    const userData: User = {
      id: res.user_id,
      name: res.name,
      email: res.email,
      role: res.role,
    };
    setUser(userData);
    setToken(res.access_token);
    localStorage.setItem('evalassist_token', res.access_token);
    localStorage.setItem('evalassist_user', JSON.stringify(userData));
    router.push('/dashboard');
  };

  const registerStudentToken = async (name: string, email: string, password: string, share_token: string) => {
    const res = await api.registerStudentToken({ name, email, password, share_token });
    const userData: User = {
      id: res.user_id,
      name: res.name,
      email: res.email,
      role: res.role,
    };
    setUser(userData);
    setToken(res.access_token);
    localStorage.setItem('evalassist_token', res.access_token);
    localStorage.setItem('evalassist_user', JSON.stringify(userData));
    router.push('/student/dashboard');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('evalassist_token');
    localStorage.removeItem('evalassist_user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        registerTeacher,
        registerStudentToken,
        logout,
        quickJoinOpen,
        setQuickJoinOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
