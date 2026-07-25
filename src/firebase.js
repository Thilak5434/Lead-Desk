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
    console.log('[Firebase] Using serviceAccountKey.json');
    const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    app = admin.initializeApp({ credential: admin.cert(sa) });
  }
  // Method 2: Single GOOGLE_APPLICATION_CREDENTIALS_JSON env var (most reliable for Render)
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.log('[Firebase] Using FIREBASE_SERVICE_ACCOUNT_JSON');
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    app = admin.initializeApp({ credential: admin.cert(sa) });
  }
  // Method 3: Individual env vars
  else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    console.log('[Firebase] Using individual env vars');
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    // Strip quotes
    if (privateKey.startsWith('"') || privateKey.startsWith("'")) {
      privateKey = privateKey.slice(1, -1);
    }
    // Convert literal \n to real newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    console.log('[Firebase] Key starts with:', privateKey.substring(0, 30));

    app = admin.initializeApp({
      credential: admin.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  else {
    throw new Error('[Firebase] No credentials found. Set FIREBASE_SERVICE_ACCOUNT_JSON or individual FIREBASE_* vars.');
  }

  db = getFirestore(app);
  console.log('[Firebase] Connected successfully');
  return { db };
}

module.exports = { initFirebase };
