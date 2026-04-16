# Admin Backend Setup Guide

## Overview

The Royal Tyres Inspection Platform includes admin functionality that requires server-side operations. This guide explains how to set up and use the admin backend for secure admin operations.

## 🔐 Security Considerations

### Why Server-Side Admin Operations?

The Firebase Admin SDK components (like the service account keys) should **NEVER** be exposed in client-side code because:

1. **Bypass Security Rules**: Server-side SDKs bypass Firestore security rules
2. **Unrestricted Access**: Can delete, modify, or access any data
3. **Private Keys Exposed**: Service account private keys would be visible in browser
4. **Audit Trail Loss**: No way to track who performed operations

### Safe Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client App (Royal Tyres Inspect)                       │
│  - Uses Vite + React                                    │
│  - Firebase Auth (client-side)                          │
│  - Firestore operations (with security rules)           │
└─────────────────────────────────────────────────────────┘
                        ↕ HTTPS
┌─────────────────────────────────────────────────────────┐
│  Backend Server (Node.js/Express)                       │
│  - Validates admin permissions                          │
│  - Firebase Admin SDK                                   │
│  - Service Account Keys (SECURE)                        │
│  - Audit Logging                                        │
└─────────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────────┐
│  Firebase / Firestore                                   │
│  - Database                                             │
│  - Authentication                                       │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Setting Up Admin Backend

### Step 1: Get Firebase Admin SDK Service Account

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `royaltyersapp`
3. Go to **Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file securely (should already have it: `royaltyersapp-firebase-adminsdk-fbsvc-406c1fbf93.json`)

### Step 2: Create Backend Server

Create a backend API server (Node.js recommended):

#### Option A: Express.js Backend

```bash
# Create backend directory
mkdir royal-tyres-backend
cd royal-tyres-backend

# Initialize npm
npm init -y

# Install dependencies
npm install express firebase-admin cors dotenv
npm install --save-dev nodemon
```

#### `backend/index.js` (Express Server Example)

```javascript
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3333',
  credentials: true
}));
app.use(express.json());

// Initialize Firebase Admin SDK
const serviceAccount = require('./royaltyersapp-firebase-adminsdk-fbsvc-406c1fbf93.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'royaltyersapp',
});

const db = admin.firestore();
const auth = admin.auth();

// Middleware: Verify admin user
async function verifyAdmin(req, res, next) {
  try {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;

    // Check if user is admin in Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ───────────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/jobs
 * Create a new job card (ADMIN ONLY)
 */
app.post('/api/admin/jobs', verifyAdmin, async (req, res) => {
  try {
    const { customer_name, license_plate, vehicle_info, service_details } = req.body;

    // Validate required fields
    if (!customer_name || !license_plate || !vehicle_info) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!vehicle_info.registration_number || !vehicle_info.make || !vehicle_info.model || !vehicle_info.year) {
      return res.status(400).json({ error: 'Missing required vehicle information' });
    }

    // Create job card
    const jobRef = db.collection('jobs').doc();
    await jobRef.set({
      vehicle_id: `V${Date.now()}`,
      customer_name,
      license_plate,
      vehicle_info,
      service_details,
      status: 'booked',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      created_by: req.user.uid,
    });

    res.json({ success: true, id: jobRef.id });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

/**
 * POST /api/admin/jobs/bulk
 * Bulk import job cards (ADMIN ONLY)
 */
app.post('/api/admin/jobs/bulk', verifyAdmin, async (req, res) => {
  try {
    const { jobs } = req.body;

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: 'Invalid jobs array' });
    }

    let imported = 0;
    let failed = 0;
    const errors = [];

    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    for (const job of jobs) {
      try {
        // Validate required fields
        if (!job.vehicle_info?.registration_number || !job.vehicle_info?.make || 
            !job.vehicle_info?.model || !job.vehicle_info?.year) {
          failed++;
          errors.push(`Job "${job.customer_name || 'Unknown'}" missing vehicle info`);
          continue;
        }

        const docRef = db.collection('jobs').doc();
        batch.set(docRef, {
          vehicle_id: `V${Date.now()}`,
          customer_name: job.customer_name || 'Unknown',
          license_plate: job.license_plate || '',
          vehicle_info: job.vehicle_info,
          service_details: job.service_details || '',
          status: 'booked',
          created_at: now,
          updated_at: now,
          created_by: req.user.uid,
        });
        imported++;
      } catch (err) {
        failed++;
        errors.push(err.message);
      }
    }

    await batch.commit();
    res.json({ success: true, imported, failed, errors: failed > 0 ? errors : undefined });
  } catch (error) {
    console.error('Error bulk importing:', error);
    res.status(500).json({ error: 'Bulk import failed' });
  }
});

/**
 * GET /api/admin/stats
 * Get admin statistics (ADMIN ONLY)
 */
app.get('/api/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const jobsSnapshot = await db.collection('jobs').get();
    const jobs = jobsSnapshot.docs.map(doc => doc.data());

    const stats = {
      total_jobs: jobs.length,
      completed_jobs: jobs.filter(j => j.status === 'completed').length,
      in_progress_jobs: jobs.filter(j => j.status === 'in_progress').length,
      booked_jobs: jobs.filter(j => j.status === 'booked').length,
      test_drive_jobs: jobs.filter(j => j.status === 'test_drive').length,
      completion_rate: jobs.length > 0 
        ? Math.round((jobs.filter(j => j.status === 'completed').length / jobs.length) * 100)
        : 0,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * DELETE /api/admin/jobs/:jobId
 * Delete a job (ADMIN ONLY) - with cascading deletes
 */
app.delete('/api/admin/jobs/:jobId', verifyAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;

    // Delete job and related documents
    await db.collection('jobs').doc(jobId).delete();
    // Also delete related inspections
    const inspectionsSnapshot = await db.collection('inspections').where('job_card_id', '==', jobId).get();
    const batch = db.batch();
    inspectionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ───────────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Admin API server running on port ${PORT}`);
});
```

#### `backend/.env`

```env
PORT=3001
CLIENT_URL=http://localhost:3333
FIREBASE_PROJECT_ID=royaltyersapp
NODE_ENV=development
```

#### `backend/package.json`

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  }
}
```

### Step 3: Update Client Configuration

Update `.env.local` with your backend URL:

```env
VITE_ADMIN_API_URL=http://localhost:3001
```

For production (Netlify):

```env
VITE_ADMIN_API_URL=https://your-backend-api.netlify.app
```

### Step 4: Run Backend Locally

```bash
cd backend
npm install
npm run dev
```

## 🔗 Deploying Backend

### Option 1: Netlify Functions

Convert your Express app to Netlify Functions.

### Option 2: Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create royal-tyres-admin-api

# Deploy
git push heroku main
```

### Option 3: Firebase Cloud Functions

```bash
npm install -g firebase-tools
firebase init functions
# Deploy functions
firebase deploy --only functions
```

## 🛡️ Security Best Practices

1. **Never expose service account keys** in client code
2. **Validate admin role** on every backend endpoint
3. **Use HTTPS** for all API calls
4. **Implement rate limiting** on admin endpoints
5. **Log all admin operations** for audit trail
6. **Use environment variables** for sensitive data
7. **Keep Admin SDK updated** regularly
8. **Restrict backend deployment** to secure servers only

## 🚨 Important Notes

- The Firebase Admin SDK is **only for backend use**
- Service account private key must be kept **confidential**
- Admin operations **bypass Firestore security rules**
- All admin actions should be **logged and audited**
- Set up **proper authentication** on backend endpoints

## Related Files

- `.env.example` - Environment variables template
- `.env.local` - Local development variables (git-ignored)
- `src/lib/adminBackend.ts` - Client-side admin helper functions
- `royaltyersapp-firebase-adminsdk-fbsvc-406c1fbf93.json` - Service account key (SECURE)

## Support

For issues or questions about admin backend setup, refer to:
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firestore Admin Documentation](https://firebase.google.com/docs/firestore/admin/start)
