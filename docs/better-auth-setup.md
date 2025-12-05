# Better Auth Implementation Guide

## Overview

This guide documents the implementation of **Better Auth** with Google OAuth for Bento Mail, replacing the previous email query parameter authentication method.

## What Changed

### Before
- Users accessed the app via a URL like: `http://localhost:3000?email=user@example.com`
- No real session management
- Email was passed as an insecure query parameter

### After
- Users sign in securely using their Google account
- Secure session management with tokens stored in MongoDB
- Session data persists across browser sessions
- Better security and user experience

## Architecture

### New Authentication Models (MongoDB Collections)

The implementation uses three new MongoDB collections to store authentication data, all built with Typegoose:

1. **Accounts** (`accounts` collection)
   - Stores OAuth provider information
   - Links user IDs with Google provider accounts
   - Stores access tokens and refresh tokens

2. **Sessions** (`sessions` collection)
   - Stores user session data
   - Contains session tokens and expiration times
   - Used for maintaining logged-in state

3. **VerificationTokens** (`verification_tokens` collection)
   - Reserved for future email verification features
   - Stores temporary tokens for email verification

### New Files Created

```
src/lib/auth/
├── index.ts              # Better Auth configuration
├── client.ts             # Frontend auth client
├── models.ts             # Typegoose models for auth
└── mongodb-adapter.ts    # MongoDB adapter for Better Auth

src/app/
├── api/
│   └── auth/
│       └── [auth]/
│           └── route.ts  # API route handler for auth endpoints
└── components/
    └── GoogleLoginButton.tsx  # Google login button component

src/app/page.tsx          # Updated home page with auth
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# Frontend public URL (for auth client)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Google Cloud Setup

1. Create a project at [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google+ API
3. Create OAuth 2.0 credentials (Web application type)
4. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID and Secret to `.env`

## How It Works

### Sign-In Flow

1. User visits `http://localhost:3000`
2. If not authenticated, they see the **Google Login Button**
3. Clicking the button redirects to Google's OAuth consent screen
4. After consent, Google redirects back to `/api/auth/callback/google`
5. Better Auth exchanges the code for tokens and creates a session
6. User is redirected to `/` and automatically fetches their bundle

### Session Management

- Sessions are stored in MongoDB with expiration times
- Session tokens are sent as HTTP-only cookies
- The `auth.api.getSession()` method retrieves the current session from headers
- Sessions persist across browser restarts

### API Routes

The auth API is available at `/api/auth/*` and handles:
- `/api/auth/signin/google` - Initiate Google sign-in
- `/api/auth/callback/google` - OAuth callback
- `/api/auth/session` - Get current session
- `/api/auth/signout` - Sign out user

## Usage

### Server-Side (Getting Current User)

```typescript
import { auth } from '@lib/auth';
import { headers } from 'next/headers';

const session = await auth.api.getSession({
  headers: await headers(),
});

if (session) {
  const userEmail = session.user.email;
  // Use email to fetch user data
}
```

### Client-Side (Sign In/Out)

```typescript
'use client';

import { signIn, signOut } from '@lib/auth/client';

// Sign in with Google
await signIn.social({
  provider: 'google',
  callbackURL: '/',
});

// Sign out
await signOut();
```

## Database

All auth data is stored in your existing MongoDB instance using Typegoose models:

- **accounts**: OAuth account links
- **sessions**: User sessions  
- **verification_tokens**: Future email verification tokens

The models automatically create the necessary collections with indexes on first use.

## Security Considerations

1. **HTTP-Only Cookies**: Session tokens are stored in HTTP-only cookies, preventing XSS attacks
2. **CSRF Protection**: Better Auth includes built-in CSRF token validation
3. **Access Token Security**: Tokens are never exposed to the frontend
4. **Session Expiration**: Sessions have configurable expiration times
5. **Trusted Origins**: Only requests from configured origins are allowed

## Migration from Query Parameters

If you need to migrate existing users:

1. The `/` route still uses the email to fetch the bundle
2. The session automatically provides the email
3. Existing API endpoints that use query parameters continue to work
4. No changes needed to other parts of the app that use email

## Troubleshooting

### Session not persisting
- Ensure `MONGODB_URI` is properly configured
- Check that auth collections exist in MongoDB
- Verify session token cookie is being set in browser dev tools

### Google sign-in fails
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check that redirect URI matches your deployment URL
- Ensure `APP_URL` and `NEXT_PUBLIC_APP_URL` are set correctly

### Collections not created
- Better Auth should auto-create them on first use
- Check MongoDB connection and permissions
- Verify Typegoose models are properly initialized

## Next Steps

1. Test locally with `npm start`
2. Create a test Google OAuth app
3. Sign in and verify session is created in MongoDB
4. Deploy and update Google OAuth redirect URIs
5. Update any documentation/marketing materials about login process
