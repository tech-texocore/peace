import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { env, isFirebaseConfigured } from "@/lib/config/env";

export const firebaseApp =
  isFirebaseConfigured && !getApps().length
    ? initializeApp(env.firebase)
    : getApps().length
      ? getApp()
      : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;

export const googleProvider = new GoogleAuthProvider();
