# LeadDesk Mini

A full-stack lead-capture product with a public landing page and a secure admin dashboard. Built with Node.js, Express, Firebase Firestore, and EJS templating.

Built for the [Digital Heroes Training Task](https://digitalheroesco.com).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Authentication Approach](#authentication-approach)
- [Validation Rules](#validation-rules)
- [Environment Variables](#environment-variables)
- [Local Setup](#local-setup)
- [Deployment](#deployment)
- [AI Usage](#ai-usage)
- [Live URLs](#live-urls)

---

## Overview

LeadDesk Mini allows potential clients to submit their contact details and project budget through a public landing page. Submitted leads are stored in Firebase Firestore and can be managed by an admin through a protected dashboard — where leads can be searched, viewed in detail, and have their status updated in real time.

---

## Features

### Public Landing Page (`/`)
- Hero section with branding
- Lead submission form: Name, Email, Budget Range, Message
- Real-time client-side validation with inline error messages
- Character counter on the Message field (max 2000)
- `Submitting...` loading state on the submit button
- Duplicate submission prevention (button disabled during request)
- Success message shown after submission, auto-dismissed after 8 seconds
- Form resets automatically after successful submission
- Server-side validation as a second layer of protection
- Privacy trust message: "Your information is kept private and never shared"
- Footer with link to Digital Heroes Training Task
- Fully responsive on mobile (480px, 768px breakpoints)

### Admin Login (`/admin/login`)
- Email + password login form
- Password stored as a bcrypt hash — never plain text
- Password visibility toggle (👁 button)
- `Signing In...` loading state on the submit button
- Generic "Invalid credentials" error (no user enumeration)
- Redirects to `/admin` on successful login
- Already-authenticated users are redirected away from login page

### Admin Dashboard (`/admin`)
- Protected — redirects to `/admin/login` if not authenticated
- Displays logged-in admin email in the header
- Logout button (destroys session, redirects to login)
- Stats cards: Total Leads, New, Contacted, Closed counts
- Search bar — filters leads by name, email, message, or status
- Leads table with columns: Name, Email, Budget, Message (truncated), Submitted Date, Status, Update, Details
- Status dropdown per lead — changes saved to Firestore instantly via PATCH API
- Status badge updates in the UI without a page reload
- "View Details" button opens a modal with the full lead information
- Empty state shown when no leads exist or no search results found

---

## Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Runtime        | Node.js v18+                        |
| Web Framework  | Express.js v5                       |
| Database       | Firebase Firestore (NoSQL)          |
| Auth           | express-session + bcrypt            |
| Templating     | EJS                                 |
| Styling        | Custom CSS (no frameworks)          |
| Frontend JS    | Vanilla JavaScript                  |
| Hosting        | Render / Railway / Fly.io           |

### Key Dependencies

| Package           | Version  | Purpose                              |
|-------------------|----------|--------------------------------------|
| `express`         | ^5.2.1   | Web server and routing               |
| `express-session` | ^1.19.0  | Server-side session management       |
| `bcrypt`          | ^6.0.0   | Password hashing and comparison      |
| `firebase-admin`  | ^14.2.0  | Firestore database access            |
| `ejs`             | ^6.0.1   | HTML templating                      |
| `dotenv`          | ^17.4.2  | Environment variable loading         |
| `cookie-parser`   | ^1.4.7   | Cookie parsing middleware            |

---

## Project Structure

```
leaddesk/
├── public/
│   ├── css/
│   │   └── style.css          # All styles (landing page + admin)
│   └── js/
│       └── validation.js      # Client-side form validation + submission
├── src/
│   ├── firebase.js            # Firebase Admin SDK initialization
│   └── server.js              # Express app, all routes and API handlers
├── views/
│   ├── index.ejs              # Public landing page
│   ├── admin-login.ejs        # Admin login page
│   └── admin-dashboard.ejs    # Admin dashboard with leads table
├── .env                       # Environment variables (not committed)
├── .gitignore
├── package.json
├── render.yaml                # Render deployment config
├── serviceAccountKey.json     # Firebase credentials (not committed)
└── README.md
```

---

## Architecture

```
Browser
  │
  ├── GET /                    → renders index.ejs (landing page)
  ├── POST /api/leads          → validates + saves lead to Firestore
  │
  ├── GET /admin/login         → renders admin-login.ejs
  ├── POST /admin/login        → verifies bcrypt hash → creates session
  │
  ├── GET /admin               → requireAuth → fetches leads → renders dashboard
  ├── PATCH /api/leads/:id/status → requireAuth → updates Firestore doc
  ├── GET /api/leads           → requireAuth → returns leads as JSON
  └── GET /admin/logout        → destroys session → redirects to login
```

**Request flow for lead submission:**
1. User fills form → client-side validation runs on blur/input
2. On submit, JS sends `POST /api/leads` with JSON body
3. Server validates all fields again (server-side)
4. If valid, Firestore document created with `status: 'New'` and timestamps
5. Success response → form resets, success message shown

**Request flow for status update:**
1. Admin changes dropdown in dashboard
2. JS sends `PATCH /api/leads/:id/status` with `{ status: "Contacted" }`
3. `requireAuth` middleware checks session — rejects with 401 if not authenticated
4. Firestore document updated with new status and `updatedAt` timestamp
5. Status badge in the table updates instantly without page reload

---

## Data Model

### Lead Document (Firestore Collection: `leads`)

| Field       | Type        | Description                                               |
|-------------|-------------|-----------------------------------------------------------|
| `name`      | `string`    | Full name (2–100 characters)                              |
| `email`     | `string`    | Email address, stored lowercase                           |
| `budget`    | `string`    | One of: `<5000`, `5000-15000`, `15000-50000`, `50000+`   |
| `message`   | `string`    | Project message (10–2000 characters)                      |
| `status`    | `string`    | One of: `New`, `Contacted`, `Closed` — default: `New`    |
| `createdAt` | `Timestamp` | Firestore server timestamp, set on creation               |
| `updatedAt` | `Timestamp` | Firestore server timestamp, updated on status change      |

Document ID is auto-generated by Firestore.

### Admin User

Admin credentials are **not stored in the database**. They are stored in environment variables:
- `ADMIN_EMAIL` — the admin's email address
- `ADMIN_PASSWORD_HASH` — bcrypt hash of the admin password (cost factor 12)

To generate a new password hash:
```js
const bcrypt = require('bcrypt');
bcrypt.hash('YourPassword', 12).then(console.log);
```

---

## API Reference

### `POST /api/leads`
Submit a new lead. Public — no authentication required.

**Request body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "budget": "5000-15000",
  "message": "I need help with my website redesign."
}
```

**Success response (`200`):**
```json
{ "success": true, "id": "<firestore-doc-id>" }
```

**Validation error (`400`):**
```json
{ "success": false, "errors": ["Name must be at least 2 characters"] }
```

---

### `GET /api/leads`
Returns all leads as JSON. Requires authentication.

**Success response (`200`):**
```json
{ "success": true, "leads": [ { "id": "...", "name": "...", ... } ] }
```

---

### `PATCH /api/leads/:id/status`
Update the status of a lead. Requires authentication.

**Request body:**
```json
{ "status": "Contacted" }
```

**Success response (`200`):**
```json
{ "success": true }
```

**Error response (`400`):**
```json
{ "success": false, "error": "Invalid status" }
```

---

### `POST /admin/login`
Authenticate as admin. Form POST (not JSON).

**Form fields:** `email`, `password`

On success: redirects to `/admin`.  
On failure: re-renders login page with generic error message.

---

### `POST /api/auth/logout`
Destroy the current session. Requires authentication.

**Success response (`200`):**
```json
{ "success": true }
```

Also available as `GET /admin/logout` which redirects to `/admin/login` after destroying the session.

---

## Authentication Approach

- **Session-based** using `express-session` with HTTP-only cookies
- Session secret loaded from `SESSION_SECRET` environment variable
- Session max age: **24 hours**
- Cookies are `secure: true` in production (HTTPS only)
- Admin password stored as a **bcrypt hash** (cost factor 12) in `ADMIN_PASSWORD_HASH`
- Login compares submitted password against the hash using `bcrypt.compare()`
- All admin routes and APIs are protected by the `requireAuth` middleware:
  - API routes return `401 Unauthorized` JSON if not authenticated
  - Page routes redirect to `/admin/login`
- On logout, `req.session.destroy()` is called — session is fully invalidated server-side

---

## Validation Rules

### Lead Form (client-side + server-side)

| Field     | Rules                                                        |
|-----------|--------------------------------------------------------------|
| `name`    | Required, 2–100 characters                                   |
| `email`   | Required, must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`         |
| `budget`  | Required, must be one of the 4 valid options                 |
| `message` | Required, 10–2000 characters                                 |

Client-side validation runs:
- On `blur` for text/email/textarea fields
- On `change` for the budget select
- On re-input if the field already has an error or success state
- On form submit (all fields validated before the request is sent)

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Firebase credentials (Method 1: use serviceAccountKey.json instead)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Admin credentials
ADMIN_EMAIL=admin@leaddesk.com
ADMIN_PASSWORD_HASH=$2b$12$...  # bcrypt hash of your password

# Session
SESSION_SECRET=a-long-random-string

# Server
PORT=3000
```

> Never commit `.env` or `serviceAccountKey.json` to version control. Both are listed in `.gitignore`.

---

## Local Setup

### Prerequisites
- Node.js v18+
- A Firebase project with Firestore enabled

### Steps

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd leaddesk
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Firebase — choose one method:

   **Method 1 (Recommended) — Service Account JSON:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Project Settings → Service Accounts → Generate New Private Key
   - Save the downloaded file as `serviceAccountKey.json` in the project root

   **Method 2 — Environment variables:**
   - Copy `project_id`, `client_email`, and `private_key` from the JSON into `.env`

4. Generate a bcrypt hash for your admin password:
   ```bash
   node -e "require('bcrypt').hash('YourPassword', 12).then(console.log)"
   ```
   Copy the output into `ADMIN_PASSWORD_HASH` in `.env`.

5. Fill in the remaining `.env` values (see [Environment Variables](#environment-variables)).

6. Start the server:
   ```bash
   npm start
   ```
   Or with auto-reload during development:
   ```bash
   npm run dev
   ```

7. Open in browser:
   - Landing page: `http://localhost:3000`
   - Admin login: `http://localhost:3000/admin/login`

---

## Deployment

The app can be deployed to any Node.js platform. A `render.yaml` config is included for Render.

### Render (recommended free tier)
1. Push code to a GitHub repository
2. Create a new Web Service on [Render](https://render.com)
3. Connect your GitHub repo
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add all environment variables from `.env` in the Render dashboard
7. Deploy

### Other platforms
- **Railway** — connect GitHub repo, set env vars, deploy
- **Fly.io** — use `fly launch` and set secrets with `fly secrets set`
- **Google Cloud Run** — containerize with Docker, deploy to Cloud Run

> Make sure `NODE_ENV=production` is set in your hosting platform so cookies are sent over HTTPS only.

---

## AI Usage

This project was built with assistance from **Amazon Q Developer** (AI coding assistant in VS Code). AI was used to:
- Scaffold the initial Express server structure
- Generate EJS templates for the landing page and admin dashboard
- Write client-side validation logic in `validation.js`
- Debug Firebase Admin SDK initialization
- Review the full checklist and identify missing features
- Improve CSS responsiveness and modal behavior

All generated code was reviewed, tested, and adjusted manually.

---

## Live URLs

- **Landing Page**: [Your Live URL]
- **Admin Dashboard**: [Your Live URL]/admin
- **Admin Login**: [Your Live URL]/admin/login
- **Test Credentials**: `admin@leaddesk.com` / [as configured in your `.env`]

---

Built for [Digital Heroes Training Task](https://digitalheroesco.com)
