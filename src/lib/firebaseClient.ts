import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  // Loud console warning instead of a silent failure — every DB call below
  // will fail until these are set.
  // eslint-disable-next-line no-console
  console.error(
    "Missing Firebase config. Add the VITE_FIREBASE_* variables to a .env file at the project root (see .env.example)."
  );
}

// Avoids "Firebase App named '[DEFAULT]' already exists" during Vite's
// hot-module-reload in dev.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// The single admin account's email. The admin only ever types the
// password on the login screen; this constant just tells Firebase Auth
// which account to sign into. Create this user once in Firebase Console →
// Authentication → Users → Add user (see README).
export const ADMIN_EMAIL =
  (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) || "admin@mosdal.com";
