'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

type ModalView = 'signIn' | 'signUp' | null;

interface AuthState {
  user: string | null; // email
  isLoading: boolean;
  modalView: ModalView;
  openSignIn: () => void;
  openSignUp: () => void;
  closeModals: () => void;
  signUp: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const USERS_KEY = 'copyflow_users';
const SESSION_KEY = 'copyflow_session';

interface StoredUser {
  email: string;
  passwordHash: string;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalView, setModalView] = useState<ModalView>(null);

  // Restore session on mount
  useEffect(() => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) setUser(session);
    setIsLoading(false);
  }, []);

  const openSignIn = useCallback(() => setModalView('signIn'), []);
  const openSignUp = useCallback(() => setModalView('signUp'), []);
  const closeModals = useCallback(() => setModalView(null), []);

  const signUp = useCallback(async (email: string, password: string) => {
    const users = getUsers();
    if (users.some((u) => u.email === email)) {
      return { ok: false, error: 'An account with this email already exists.' };
    }
    const passwordHash = await hashPassword(password);
    users.push({ email, passwordHash });
    saveUsers(users);
    localStorage.setItem(SESSION_KEY, email);
    setUser(email);
    closeModals();
    return { ok: true };
  }, [closeModals]);

  const signIn = useCallback(async (email: string, password: string) => {
    const users = getUsers();
    const found = users.find((u) => u.email === email);
    if (!found) {
      return { ok: false, error: 'No account found with this email.' };
    }
    const passwordHash = await hashPassword(password);
    if (found.passwordHash !== passwordHash) {
      return { ok: false, error: 'Incorrect password.' };
    }
    localStorage.setItem(SESSION_KEY, email);
    setUser(email);
    closeModals();
    return { ok: true };
  }, [closeModals]);

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        modalView,
        openSignIn,
        openSignUp,
        closeModals,
        signUp,
        signIn,
        signOut,
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
