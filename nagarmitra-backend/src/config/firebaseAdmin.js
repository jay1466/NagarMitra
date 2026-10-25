import admin from 'firebase-admin';

function stripQuotes(v) {
  if (typeof v !== 'string') return v;
  const m = v.match(/^"([\s\S]*)"$/);
  return m ? m[1] : v;
}

function readServiceEnv() {
  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = stripQuotes(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  let privateKey = stripQuotes(process.env.FIREBASE_PRIVATE_KEY || '');
  const privateKeyB64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;

  // Decode from base64 if provided
  if (!privateKey && privateKeyB64) {
    try {
      privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');
    } catch (err) {
      console.error('[FirebaseAdmin] Failed to decode base64 private key:', err.message);
    }
  }

  // Always normalize newlines
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return { projectId, clientEmail, privateKey };
}

let app;
if (!admin.apps.length) {
  const { projectId, clientEmail, privateKey } = readServiceEnv();

  if (projectId && clientEmail && privateKey) {
    app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    console.log('[FirebaseAdmin] Initialized with service account');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('[FirebaseAdmin] Initialized with ADC JSON file');
  } else {
    console.warn('[FirebaseAdmin] Missing service account env vars. Auth middleware will reject requests.', {
      hasProject: !!projectId,
      hasEmail: !!clientEmail,
      hasKey: !!privateKey,
    });
  }
}

export const firebaseAdmin = admin;
