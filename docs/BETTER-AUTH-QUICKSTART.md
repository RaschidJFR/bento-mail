# Quick Start: Better Auth Setup

## 1. Install Dependencies ✓

```bash
npm install better-auth
```

The package is already installed. Check other dependencies in `package.json`:
- ✓ `mongodb` - MongoDB driver
- ✓ `mongoose` - ODM for MongoDB
- ✓ `@typegoose/typegoose` - Typegoose for models

## 2. Set Environment Variables

Update `.env` with Google OAuth credentials:

```bash
# Google OAuth (https://console.cloud.google.com/)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Make sure these are also set:
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://...
DATABASE_NAME=production
```

## 3. Get Google OAuth Credentials

1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials (Web application type)
5. Add authorized redirect URI:
   - **Local**: `http://localhost:3000/api/auth/callback/google`
   - **Production**: `https://yourdomain.com/api/auth/callback/google`
6. Copy Client ID and Secret to `.env`

## 4. Files Created

All files have been created:

- ✓ `src/lib/auth/index.ts` - Auth configuration
- ✓ `src/lib/auth/client.ts` - Frontend auth client
- ✓ `src/lib/auth/models.ts` - Auth data models
- ✓ `src/lib/auth/mongodb-adapter.ts` - MongoDB integration
- ✓ `src/app/api/auth/[auth]/route.ts` - API routes
- ✓ `src/app/components/GoogleLoginButton.tsx` - Login button
- ✓ `src/app/page.tsx` - Updated home page
- ✓ `.env.example` - Updated with auth variables
- ✓ `README.md` - Updated documentation
- ✓ `docs/better-auth-setup.md` - Full setup guide

## 5. Test Locally

```bash
npm start
```

Then:
1. Open http://localhost:3000
2. Click "Sign in with Google"
3. Sign in with your Google account
4. You should be redirected to your bundle

## 6. Verify in MongoDB

Check that these collections were created in MongoDB:
- `accounts` - OAuth provider links
- `sessions` - User sessions
- `verification_tokens` - (for future use)

## What Changed from Before

| Before | After |
|--------|-------|
| Email in URL params | Google OAuth sign-in |
| No session management | Secure sessions in MongoDB |
| Insecure query params | HTTP-only session cookies |
| No user privacy | Privacy-respecting authentication |

## Usage in Your Code

### Get Current User (Server)
```typescript
import { auth } from '@lib/auth';
import { headers } from 'next/headers';

const session = await auth.api.getSession({
  headers: await headers(),
});

if (session?.user) {
  console.log(session.user.email);
}
```

### Sign In/Out (Client)
```typescript
import { signIn, signOut } from '@lib/auth/client';

// Sign in
await signIn.social({ provider: 'google', callbackURL: '/' });

// Sign out
await signOut();
```

## Troubleshooting

**Session not created?**
- Check MONGODB_URI is correct
- Verify Google credentials in .env
- Check browser console for errors

**Collections not in MongoDB?**
- They should auto-create on first sign-in
- Check MongoDB connection permissions
- Verify DATABASE_NAME is correct

**Google sign-in fails?**
- Verify redirect URI matches exactly
- Check GOOGLE_CLIENT_ID and SECRET are correct
- Ensure NEXT_PUBLIC_APP_URL is set

## Next Steps

1. Remove any old email query parameter logic
2. Update API endpoints that relied on email param
3. Test the full flow end-to-end
4. Deploy with proper Google OAuth credentials
5. Update any documentation about the login process

See `docs/better-auth-setup.md` for detailed architecture documentation.
