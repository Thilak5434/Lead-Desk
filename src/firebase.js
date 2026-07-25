const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

let db = null;

function initFirebase() {
  if (db) return { db };

  let app;

  // Method 1: serviceAccountKey.json (local dev)
  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    console.log('[Firebase] Loading from serviceAccountKey.json');
    const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    app = admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  // Method 2: Environment variables (Render / production)
  else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    console.log('[Firebase] Loading from environment variables');

    // Render stores the key as a single line with literal \n — fix it
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    // Strip surrounding quotes if present
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    // Replace literal \n with real newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      throw new Error('[Firebase] FIREBASE_PRIVATE_KEY does not contain a valid private key');
    }

    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  else {
    throw new Error(
      '[Firebase] No credentials found.\n' +
      'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in environment variables.'
    );
  }

  db = getFirestore(app);
  console.log('[Firebase] Firestore connected');
  return { db };
}

module.exports = { initFirebase };
