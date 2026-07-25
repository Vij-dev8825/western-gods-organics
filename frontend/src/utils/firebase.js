import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Public, non-secret config — safe to ship in the client bundle (Firebase's
// own design; protected by project settings/Security Rules, not secrecy).
// Set these as VITE_* env vars at build time (see render.yaml).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);

export const firebaseApp = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
