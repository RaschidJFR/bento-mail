# Getting Started with Better Auth

## ✅ What's Been Done

All code has been implemented:
- ✅ Better Auth installed
- ✅ Auth server configured with MongoDB adapter
- ✅ Auth API routes created
- ✅ Google login button component created
- ✅ Home page updated
- ✅ Documentation created
- ✅ Environment variables documented

## 🚀 Next Steps (3 Simple Steps)

### Step 1: Get Google OAuth Credentials

1. Go to https://console.cloud.google.com/
2. Create a new project (or use existing)
3. Enable **Google+ API**
4. Go to **Credentials** → Create **OAuth 2.0 Client ID**
   - Application type: **Web application**
5. Add **Authorized redirect URI**: 
   - `http://localhost:3000/api/auth/callback/google`
6. Copy the **Client ID** and **Client Secret**

### Step 2: Update `.env`

Add to your `.env` file:

```bash
# Google OAuth credentials (from step 1)
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Make sure these are set:
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 3: Start and Test

```bash
npm start
```

Then:
1. Open http://localhost:3000
2. Click **"Sign in with Google"**
3. Sign in with your Google account
4. You should be logged in and redirected to your bundle!

## ✨ That's It!

Your app now has secure Google OAuth authentication. No more email in URL parameters!

## 📖 Documentation

- **Quick Reference**: This file
- **Setup Details**: `docs/BETTER-AUTH-QUICKSTART.md`
- **Full Architecture**: `docs/better-auth-setup.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`

## 🔍 How to Verify It's Working

1. **Check Browser**
   - Sign in and check cookie storage in DevTools
   - You should see `sessionToken` or similar cookie

2. **Check MongoDB**
   ```javascript
   // In MongoDB shell or UI, you should see these new collections:
   db.accounts.find()          // OAuth provider info
   db.sessions.find()          // Active sessions
   db.verification_tokens.find() // (empty for now)
   ```

3. **Check Console**
   - No errors in browser console
   - Session should load immediately after sign-in

## 🛠️ Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid redirect URI" | Make sure redirect URI in Google OAuth matches exactly |
| Session doesn't persist | Check MONGODB_URI is correct and database exists |
| Sign-in button doesn't work | Check browser console for errors, verify GOOGLE_CLIENT_ID |
| Can't find session in MongoDB | Give it a few seconds, collections are created on first use |

## 📝 Code Examples

### Getting User Email (Server)
```typescript
import { auth } from '@lib/auth';
import { headers } from 'next/headers';

async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (session?.user) {
    console.log(session.user.email); // ✅ Use email from session
  }
}
```

### Sign Out (Client)
```typescript
'use client';

import { signOut } from '@lib/auth/client';

export function SignOutButton() {
  return (
    <button onClick={() => signOut()}>
      Sign Out
    </button>
  );
}
```

## 🔐 Security Features

- ✅ HTTP-only cookies (XSS protection)
- ✅ CSRF tokens (automatic)
- ✅ Secure token storage in MongoDB
- ✅ Session expiration
- ✅ OAuth 2.0 standard

## 📦 What's New in MongoDB

Three collections are automatically created:

1. **accounts** - Links your app to Google OAuth account
2. **sessions** - Stores user sessions  
3. **verification_tokens** - For future email verification

All are indexed for fast lookups and unique constraints.

## 🚢 Deploying to Production

When deploying (e.g., to Railway, Vercel, etc.):

1. Update Google OAuth redirect URI to your production URL:
   - `https://yourdomain.com/api/auth/callback/google`

2. Update `.env` variables:
   ```bash
   APP_URL=https://yourdomain.com
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   GOOGLE_CLIENT_ID=production-client-id
   GOOGLE_CLIENT_SECRET=production-client-secret
   ```

3. Deploy as usual

## ❓ Questions?

- Check `docs/better-auth-setup.md` for architecture details
- Visit https://better-auth.com/ for Better Auth documentation
- Review `IMPLEMENTATION_SUMMARY.md` for what was changed

## 🎉 You're All Set!

Your Bento Mail app now has secure, professional authentication. Users can sign in with their Google accounts and their data will be stored securely in MongoDB.

Enjoy! 🚀
