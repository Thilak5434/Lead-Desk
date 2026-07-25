const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let db = null;
let auth = null;

function initFirebase() {
  if (db) return { db, auth };

  let app;

  // METHOD 1: Try loading from serviceAccountKey.json file
  const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    console.log('Loading Firebase credentials from serviceAccountKey.json');
    const serviceAccount = require(serviceAccountPath);
    const certFn = admin.credential ? admin.credential.cert : admin.cert;
    app = admin.initializeApp({ credential: certFn(serviceAccount) });
  } 
  // METHOD 2: Use individual environment variables
  else if (process.env.FIREBASE_PROJECT_ID && 
           process.env.FIREBASE_CLIENT_EMAIL && 
           process.env.FIREBASE_PRIVATE_KEY &&
           process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY') &&
           !process.env.FIREBASE_PRIVATE_KEY.includes('YOUR_PRIVATE_KEY')) {
    console.log('Loading Firebase credentials from environment variables');
    
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      .replace(/\\n/g, '\n')
      .replace(/^"|"$/g, '')
      .trim();

    const certFn = admin.credential ? admin.credential.cert : admin.cert;
    app = admin.initializeApp({
      credential: certFn({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  } 
  else {
    throw new Error(
      'No valid Firebase credentials found.\n' +
      'Option 1: Download serviceAccountKey.json from Firebase Console > Project Settings > Service Accounts\n' +
      '         and save it as "serviceAccountKey.json" in the project root.\n' +
      'Option 2: Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env\n' +
      '         (FIREBASE_PRIVATE_KEY must contain a valid private key)'
    );
  }

  db = getFirestore(app);
  auth = getAuth(app);
  return { db, auth };
}

module.exports = { initFirebase };