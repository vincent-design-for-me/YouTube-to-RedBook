'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type ModalView = 'signIn' | 'signUp' | 'forgotPassword' | null;

interface AuthState {
  user: User | null;
  isLoading: boolean;
  modalView: ModalView;
  openSignIn: () => void;
  openSignUp: () => void;
  openForgotPassword: () => void;
  closeModals: () => void;
  signUp: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalView, setModalView] = useState<ModalView>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const openSignIn = useCallback(() => setModalView('signIn'), []);
  const openSignUp = useCallback(() => setModalView('signUp'), []);
  const openForgotPassword = useCallback(() => setModalView('forgotPassword'), []);
  const closeModals = useCallback(() => setModalView(null), []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };
    closeModals();
    return { ok: true };
  }, [supabase.auth, closeModals]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    closeModals();
    return { ok: true };
  }, [supabase.auth, closeModals]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase.auth]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, [supabase.auth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        modalView,
        openSignIn,
        openSignUp,
        openForgotPassword,
        closeModals,
        signUp,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
