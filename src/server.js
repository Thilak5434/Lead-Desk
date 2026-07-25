const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const { initFirebase } = require('./firebase');
const { Timestamp } = require('firebase-admin/firestore');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

let db;
try {
  db = initFirebase().db;
  console.log('[Server] Firebase ready');
} catch (err) {
  console.error('[Server] Firebase FAILED:', err.message);
  console.error('[Server] Leads will return 500 until Firebase is configured');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: true,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));

function requireAuth(req, res, next) {
  if (req.session && req.session.isAuthenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ success: false, error: 'Unauthorized' });
  res.redirect('/admin/login');
}

const VALID_BUDGETS = ['<5000', '5000-15000', '15000-50000', '50000+'];
const VALID_STATUSES = ['New', 'Contacted', 'Closed'];

function validateLead({ name, email, budget, message }) {
  const errors = [];
  if (!name || name.trim().length < 2) errors.push('Name must be at least 2 characters');
  if (name && name.trim().length > 100) errors.push('Name must be under 100 characters');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Please provide a valid email address');
  if (!budget || !VALID_BUDGETS.includes(budget)) errors.push('Please select a valid budget range');
  if (!message || message.trim().length < 10) errors.push('Message must be at least 10 characters');
  if (message && message.trim().length > 2000) errors.push('Message must be under 2000 characters');
  return errors;
}

// ── Public Landing Page ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.render('index', { title: 'LeadDesk - Get Started' });
});

// ── POST /api/leads ──────────────────────────────────────────────────────────
app.post('/api/leads', async (req, res) => {
  const { name, email, budget, message } = req.body;
  const errors = validateLead({ name, email, budget, message });
  if (errors.length) return res.status(400).json({ success: false, errors });
  if (!db) return res.status(500).json({ success: false, errors: ['Database not available'] });

  try {
    const now = Timestamp.now();
    const docRef = await db.collection('leads').add({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      budget,
      message: message.trim(),
      status: 'New',
      createdAt: now,
      updatedAt: now,
    });
    res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error('Lead submission error:', err);
    res.status(500).json({ success: false, errors: ['An unexpected error occurred. Please try again.'] });
  }
});

// ── Admin Login ──────────────────────────────────────────────────────────────
app.get('/admin/login', (req, res) => {
  if (req.session?.isAuthenticated) return res.redirect('/admin');
  res.render('admin-login', { title: 'Admin Login - LeadDesk', error: null });
});

app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const fail = (msg) => res.render('admin-login', { title: 'Admin Login - LeadDesk', error: msg });

  if (!email || !password) return fail('Email and password are required');

  try {
    if (email !== process.env.ADMIN_EMAIL) return fail('Invalid credentials');

    const hash = process.env.ADMIN_PASSWORD_HASH;
    const valid = hash
      ? await bcrypt.compare(password, hash)
      : password === process.env.ADMIN_PASSWORD;

    if (!valid) return fail('Invalid credentials');

    req.session.isAuthenticated = true;
    req.session.adminEmail = email;
    res.redirect('/admin');
  } catch (err) {
    console.error('Login error:', err);
    fail('An error occurred. Please try again.');
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ── GET /admin (dashboard) ───────────────────────────────────────────────────
app.get('/admin', requireAuth, async (req, res) => {
  const renderWith = (leads, search, error) =>
    res.render('admin-dashboard', { title: 'Admin Dashboard - LeadDesk', leads, search, error, adminEmail: req.session.adminEmail });

  if (!db) return renderWith([], '', 'Database not configured');

  try {
    const search = (req.query.search || '').trim();
    const snapshot = await db.collection('leads').orderBy('createdAt', 'desc').get();

    let leads = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      leads.push({
        id: doc.id,
        ...d,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
      });
    });

    if (search) {
      const s = search.toLowerCase();
      leads = leads.filter(l =>
        l.name?.toLowerCase().includes(s) ||
        l.email?.toLowerCase().includes(s) ||
        l.message?.toLowerCase().includes(s) ||
        l.status?.toLowerCase().includes(s)
      );
    }

    renderWith(leads, search, null);
  } catch (err) {
    console.error('Dashboard error:', err);
    renderWith([], '', 'Error loading leads: ' + err.message);
  }
});

// ── GET /api/leads (JSON for future use) ────────────────────────────────────
app.get('/api/leads', requireAuth, async (req, res) => {
  if (!db) return res.status(500).json({ success: false, error: 'Database not available' });
  try {
    const snapshot = await db.collection('leads').orderBy('createdAt', 'desc').get();
    const leads = [];
    snapshot.forEach(doc => leads.push({ id: doc.id, ...doc.data() }));
    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/leads/:id/status ──────────────────────────────────────────────
app.patch('/api/leads/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status))
    return res.status(400).json({ success: false, error: 'Invalid status' });
  if (!db) return res.status(500).json({ success: false, error: 'Database not available' });

  try {
    await db.collection('leads').doc(req.params.id).update({ status, updatedAt: Timestamp.now() });
    res.json({ success: true });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// keep old POST route for backward compat
app.post('/api/leads/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status))
    return res.status(400).json({ success: false, error: 'Invalid status' });
  if (!db) return res.status(500).json({ success: false, error: 'Database not available' });
  try {
    await db.collection('leads').doc(req.params.id).update({ status, updatedAt: Timestamp.now() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).redirect('/'));

app.listen(PORT, () => {
  console.log(`LeadDesk running at http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin/login`);
});
