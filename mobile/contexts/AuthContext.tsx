import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from '@firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { getFirebaseAuth } from '../lib/firebase';
import api from '../services/api';

interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = getFirebaseAuth();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const token = await firebaseUser.getIdToken();
        await SecureStore.setItemAsync('firebase_token', token);
        const res = await api.post('/auth/verify') as { data?: { user?: AuthUser }; success?: boolean };
        setUser(res.data?.user ?? null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const token = await cred.user.getIdToken();
    await SecureStore.setItemAsync('firebase_token', token);
    const res = await api.post('/auth/verify') as { data?: { user?: AuthUser }; success?: boolean };
    setUser(res.data?.user ?? null);
  };

  const register = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    phone?: string
  ) => {
    const res = await api.post('/auth/register', {
      email,
      password,
      firstName,
      lastName,
      phone,
    }) as { data?: { token?: string; user?: AuthUser }; success?: boolean };
    const data = res.data ?? res as { token?: string; user?: AuthUser };
    if (data?.token) {
      const { signInWithCustomToken } = await import('@firebase/auth');
      await signInWithCustomToken(auth, data.token);
      setUser(data.user ?? null);
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    await SecureStore.deleteItemAsync('firebase_token');
    setUser(null);
  };

  const resetPassword = async (_email: string) => {
    // Stubbed for Phase 0
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
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
