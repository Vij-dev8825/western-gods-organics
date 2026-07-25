const admin = require('firebase-admin');

let app = null;

// Lazy init (not at module load) so a missing/incomplete service account
// just leaves `app` null — routes can then return a clear "not configured"
// error instead of crashing the whole process on boot.
function getApp() {
  if (app) return app;
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return null;

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // Render env vars can't hold real newlines, so the private key is
      // stored with literal "\n" and unescaped back to real ones here.
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
  return app;
}

function isConfigured() {
  return Boolean(getApp());
}

/** Verifies a Firebase phone-auth ID token and returns its decoded claims
 * (includes `phone_number` in E.164 format, e.g. "+919876543210"). */
async function verifyIdToken(idToken) {
  const firebaseApp = getApp();
  if (!firebaseApp) {
    const err = new Error("Phone login isn't configured on the server yet.");
    err.status = 503;
    throw err;
  }
  return admin.auth(firebaseApp).verifyIdToken(idToken);
}

module.exports = { isConfigured, verifyIdToken };
