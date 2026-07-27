"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { api } from "@/lib/api/client";

export interface AdminProfile {
  id: string;
  email: string;
  name?: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "STAFF";
  storeId?: string | null;
  store?: { id: string; name: string; slug: string } | null;
  roleRef?: { permissions: string[] } | null;
}

interface AdminAuthValue {
  user: User | null;
  profile: AdminProfile | null;
  storeId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AdminAuthContext = createContext<AdminAuthValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth, async (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setStoreId(null);
        setLoading(false);
        return;
      }
      try {
        const me = await api.get<AdminProfile>("/admin-users/me", { auth: true });
        setProfile(me);
        if (me?.storeId) {
          setStoreId(me.storeId);
        } else {
          const stores = await api.get<{ id: string }[]>("/stores", { auth: true });
          setStoreId(stores?.[0]?.id ?? null);
        }
      } catch {
        setProfile(null);
        setStoreId(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error("Auth is not configured");
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  }, []);

  const logout = useCallback(async () => {
    if (firebaseAuth) await signOut(firebaseAuth);
    setProfile(null);
    setStoreId(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!profile) return false;
      if (profile.role === "SUPER_ADMIN") return true;
      return profile.roleRef?.permissions?.includes(permission) ?? false;
    },
    [profile],
  );

  const value = useMemo(
    () => ({ user, profile, storeId, loading, login, logout, hasPermission }),
    [user, profile, storeId, loading, login, logout, hasPermission],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
