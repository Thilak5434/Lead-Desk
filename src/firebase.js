const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

let db = null;

function parsePrivateKey(raw) {
  let key = raw;
  // Strip surrounding quotes
  if ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Replace literal \n with real newlines
  key = key.replace(/\\n/g, '\n');
  // Normalize line endings
  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return key.trim();
}

function initFirebase() {
  if (db) return { db };

  let app;

  // Method 1: serviceAccountKey.json (local dev)
  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    console.log('[Firebase] Using serviceAccountKey.json');
    const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    app = admin.initializeApp({ credential: admin.cert(sa) });
  }
  // Method 2: Environment variables (Render / production)
  else {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawKey      = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !rawKey) {
      throw new Error(
        '[Firebase] Missing env vars. Need: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
      );
    }

    const privateKey = parsePrivateKey(rawKey);

    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      console.error('[Firebase] Key preview:', privateKey.substring(0, 80));
      throw new Error('[Firebase] FIREBASE_PRIVATE_KEY is malformed — does not contain BEGIN PRIVATE KEY');
    }

    console.log('[Firebase] Using environment variables');
    console.log('[Firebase] Project:', projectId);
    console.log('[Firebase] Client email:', clientEmail);

    app = admin.initializeApp({
      credential: admin.cert({ projectId, clientEmail, privateKey }),
    });
  }

  db = getFirestore(app);
  console.log('[Firebase] Firestore connected successfully');
  return { db };
}

module.exports = { initFirebase };
