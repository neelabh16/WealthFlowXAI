"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import type { AuthSession, AuthUser, LoginPayload, RegisterPayload } from "@/types";

const SESSION_STORAGE_KEY = "wealthflow-session";

type LoginResponse = {
  access: string;
  refresh: string;
};

type AuthContextValue = {
  hydrated: boolean;
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as AuthSession;
    if (parsedValue.accessToken && parsedValue.refreshToken) {
      return parsedValue;
    }
  } catch {}

  return null;
}

function persistSession(session: AuthSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  const logout = () => {
    setUser(null);
    setSession(null);
    persistSession(null);
  };

  const refreshUser = async (activeSession = session) => {
    if (!activeSession?.accessToken) {
      setUser(null);
      return;
    }

    try {
      const profile = await apiRequest<AuthUser>("/auth/me/", {
        method: "GET",
        token: activeSession.accessToken,
      });
      setUser(profile);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        return;
      }

      throw error;
    }
  };

  useEffect(() => {
    const storedSession = readStoredSession();
    setSession(storedSession);

    if (!storedSession) {
      setHydrated(true);
      return;
    }

    refreshUser(storedSession)
      .catch(() => {
        logout();
      })
      .finally(() => {
        setHydrated(true);
      });
  }, []);

  const login = async (payload: LoginPayload) => {
    const tokens = await apiRequest<LoginResponse>("/auth/login/", {
      method: "POST",
      body: payload,
    });

    const nextSession = {
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
    };

    setSession(nextSession);
    persistSession(nextSession);
    await refreshUser(nextSession);
  };

  const register = async (payload: RegisterPayload) => {
    await apiRequest("/auth/register/", {
      method: "POST",
      body: payload,
    });

    await login({
      email: payload.email,
      password: payload.password,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        hydrated,
        user,
        session,
        isAuthenticated: Boolean(user && session?.accessToken),
        login,
        register,
        logout,
        refreshUser: () => refreshUser(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
