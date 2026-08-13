"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase/client";
import { api } from "@/lib/api/client";

type AdminRole = "SUPER_ADMIN" | "ADMIN" | "STAFF";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  role: AdminRole | null;
  isAdmin: boolean;
  hasPasswordLogin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AdminRole | null>(null);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth, async (u) => {
      setUser(u);
      if (u) {
        try { const token = await u.getIdTokenResult(); setRole(((token.claims.role as AdminRole) ?? null) || null); }
        catch { setRole(null); }
        // Ensure a backend profile exists so user-scoped pages (checkout, account) never 404.
        api.get("/account/me", { auth: true }).catch(() => {});
      } else {
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      role,
      isAdmin: role === "SUPER_ADMIN" || role === "ADMIN" || role === "STAFF",
      hasPasswordLogin: !!user?.providerData.some((p) => p.providerId === "password"),
      signInWithGoogle: async () => {
        if (!firebaseAuth) throw new Error("Auth is not configured");
        await signInWithPopup(firebaseAuth, googleProvider);
      },
      signInWithEmail: async (email, password) => {
        if (!firebaseAuth) throw new Error("Auth is not configured");
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      },
      signUpWithEmail: async (name, email, password) => {
        if (!firebaseAuth) throw new Error("Auth is not configured");
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
      },
      resetPassword: async (email) => {
        if (!firebaseAuth) throw new Error("Auth is not configured");
        await sendPasswordResetEmail(firebaseAuth, email);
      },
      changePassword: async (currentPassword, newPassword) => {
        const u = firebaseAuth?.currentUser;
        if (!u || !u.email) throw new Error("You must be signed in with an email and password.");
        const cred = EmailAuthProvider.credential(u.email, currentPassword);
        await reauthenticateWithCredential(u, cred);
        await updatePassword(u, newPassword);
      },
      logout: async () => {
        if (firebaseAuth) await signOut(firebaseAuth);
      },
    }),
    [user, loading, role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
