# Google Authentication Setup Guide

This guide explains how to configure Google Sign-In for the Royal Tyres Inspection app.

## Overview

The app uses Firebase Authentication with Google Sign-In. Users can sign in with their @royaltyres.co.za Google account using the "Continue with Google" button on the login page.

## Firebase Configuration

### 1. Enable Google Sign-In in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **royaltyersapp**
3. Navigate to **Authentication** → **Sign-in method**
4. Find **Google** and click it
5. Toggle the switch to **Enable**
6. Select a **Project support email** for Google Cloud
7. Click **Save**

### 2. Configure OAuth Consent Screen

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Click the **Service Accounts** tab
3. Click **Go to Google Cloud Console** row
4. Navigate to **APIs & Services** → **OAuth consent screen**
5. Choose **Internal** (for @royaltyres.co.za domain users only) or **External**
6. Click **Create**
7. Fill in the form:
   - **App name**: Royal Tyres Inspection
   - **User support email**: your-email@royaltyres.co.za
   - **Developer contact**: your-email@royaltyres.co.za
8. Click **Save & Continue**
9. On **Scopes** page, click **Save & Continue** (default scopes are fine)
10. On **Summary** page, click **Back to Dashboard**

### 3. Add Authorized JavaScript Origins

1. In Google Cloud Console, go to **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID (Web Application)
3. Click the pencil icon to edit
4. Under **Authorized JavaScript origins**, add:

**Development:**
```
http://localhost:5173
http://localhost:8080
```

**Production:**
```
https://royal-tyres-inspect.netlify.app
https://your-custom-domain.com
```

5. Click **Save**

## Local Development Setup

### 1. Environment Variables

Ensure `.env.local` has the correct Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=royaltyersapp.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=royaltyersapp
VITE_FIREBASE_STORAGE_BUCKET=royaltyersapp.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 2. Start Development Server

```bash
npm run dev
```

The app runs on `http://localhost:5173` by default.

### 3. Test Google Sign-In

1. Click **"Continue with Google"** button
2. Select your @royaltyres.co.za Google account
3. Authorize the app when prompted
4. You should be logged in as Mechanic role (can change on login page)

## Email Domain Validation

The app enforces that **only @royaltyres.co.za emails can sign in via Google**:

- If you sign in with a non-company email, the app will:
  1. Detect the domain mismatch
  2. Sign out the user
  3. Display error: "Please use your @royaltyres.co.za email address to sign in"

This is a security feature to ensure only company employees can use the inspection system.

## Troubleshooting

### "Google Sign-in not available" or Popup blocked

**Problem**: Popup window doesn't open when clicking Google Sign-In button

**Solutions**:
1. Check if your browser blocks popups for this domain
2. Add `localhost:5173` to browser's popup whitelist
3. Check that **Authorized JavaScript origins** includes your current URL
4. Verify Google Sign-In is **enabled** in Firebase Console

### "Please use your @royaltyres.co.za email address"

**Problem**: Signed in with wrong email

**Solution**: Use your company Google account (@royaltyres.co.za)

### CORS or Network Errors

**Problem**: Error in browser console like "CORS policy" or "Network request failed"

**Solutions**:
1. Verify Firebase auth domain matches your URL
2. Check that `royaltyersapp.firebaseapp.com` is accessible
3. Ensure internet connection is stable
4. Check browser console for detailed error messages

### Users Can't Create Accounts with Google

**Problem**: Google sign-in works but no user profile is created

**Solutions**:
1. Verify Firestore database rules allow creating user documents
2. Check that firestore.ts `createUserProfile()` function is working
3. Look at Firebase Console → Firestore → Rules to ensure they allow writes

## Code Implementation

### Key Files

**AuthContext.tsx**: Main auth logic
- `loginWithGoogle()` - Handles popup, domain validation, profile creation
- `googleProvider` - Configured with custom parameters for account selection

**firebase.ts**: Firebase initialization
- Loads configuration from environment variables
- Validates all required variables at startup

**LoginPage.tsx**: UI component
- Google button with provider-specific error handling
- Email domain validation feedback
- Role selector (Admin/Mechanic)

### How It Works

1. User clicks "Continue with Google"
2. `handleGoogle()` is triggered
3. `loginWithGoogle(selectedRole)` called
4. Firebase opens Google sign-in popup
5. After sign-in:
   - Email domain is validated
   - User profile is created in Firestore if new
   - User is redirected to dashboard (Admin/Mechanic)

## Production Deployment (Netlify)

1. Add all environment variables to **Netlify Dashboard** → **Site settings** → **Build & deploy** → **Environment**
2. Add production URLs to **Google OAuth Authorized Origins**
3. Set `VITE_APP_ENV=production` in Netlify env vars (optional, for debugging)
4. Deploy and test Google Sign-In

## Security Notes

- Google OAuth credentials are **API key** (public, safe in client code)
- **Admin SDK credentials** should **never** be in `.env.local` (server-side only)
- Email domain validation ensures only company users can access
- All sensitive operations require Firebase Security Rules

## Support

For issues with Google authentication:
1. Check browser console for error codes
2. Verify Firebase Console settings match this guide
3. Check that OAuth consent screen status is "Published" (not in testing)
4. Verify your Google account is in the OAuth app's test users (if in testing mode)

