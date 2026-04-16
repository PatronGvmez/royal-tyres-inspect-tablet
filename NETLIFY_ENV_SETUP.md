# Netlify Environment Variables Setup Guide

## Overview
This project uses Firebase for authentication and database. All sensitive credentials are stored as environment variables and are **NOT** committed to the repository.

## Local Development

1. **Create `.env.local` file** in the project root:
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your Firebase credentials** in `.env.local`:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

3. **Run locally**:
   ```bash
   npm run dev
   ```

## Netlify Deployment

### Step 1: Add Environment Variables to Netlify
1. Go to your Netlify site dashboard
2. Navigate to **Site Settings** → **Build & Deploy** → **Environment**
3. Click **Add environment variables**
4. Add each variable from `.env.example`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`

**Important**: Copy the VALUES from your `.env.local` file (NOT the placeholders from `.env.example`)

### Step 2: Verify Environment Variables in Netlify Build
1. The build logs will show which variables were loaded
2. Check that no errors appear about missing environment variables
3. The app should initialize Firebase correctly during build

### Step 3: Connect Repository
1. Push your code to GitHub/GitLab/Bitbucket (WITHOUT `.env.local` - it's in `.gitignore`)
2. Connect your repository to Netlify
3. Netlify will automatically use the environment variables you set in Step 1

### Step 4: Monitor Deployment
1. Check the deployment logs in Netlify for any Firebase initialization errors
2. Test authentication and database operations in the deployed app

## Environment Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `myproject.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | `my-project` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | `my-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging ID | `123456789` |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | `1:123456789:web:abc...` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics ID | `G-ABC123` |

## Vite Environment Variables

- All variables must be prefixed with `VITE_` to be accessible in the client-side code
- Variables are read by `import.meta.env.VITE_*` in the application
- Non-`VITE_` prefixed variables are private to the build system only

## Security Best Practices

1. **Never commit `.env.local`** - it's already in `.gitignore`
2. **Use `.env.example`** as a template for new developers
3. **Rotate credentials regularly** if they're ever exposed
4. **Use different Firebase projects** for development, staging, and production
5. **Review Netlify environment variable permissions** periodically
6. **Enable Firebase Security Rules** to restrict database access

## Troubleshooting

### "Missing required environment variable" error
- Check that you've added ALL required variables to Netlify
- Verify variable names match exactly (including `VITE_` prefix)
- Redeploy after adding variables

### Firebase initialization fails
- Verify all Firebase credentials are correct
- Check that the Project ID matches your Firebase project
- Ensure Firestore and Firebase Auth are enabled in your Firebase project

### App works locally but not on Netlify
- Check Netlify build logs for environment variable warnings
- Verify variables are set in Netlify Site Settings (not just in `.toml` file)
- Clear Netlify cache and redeploy

## Related Files
- `.env.example` - Template with all required variables
- `.env.local` - Local development credentials (NOT in git)
- `.gitignore` - Ignores `.env` and `.env.local` files
- `src/lib/firebase.ts` - Loads environment variables and initializes Firebase
