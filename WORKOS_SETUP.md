# WorkOS Setup Guide

This guide explains how to set up WorkOS authentication for the Social Media Stack.

## Create a WorkOS Account

1. Go to [WorkOS](https://workos.com) and sign up for a free account
2. Create a new organization in the WorkOS dashboard

## Configure AuthKit

1. In the WorkOS dashboard, navigate to **AuthKit** (User Management)
2. Enable AuthKit for your organization
3. Configure your authentication methods:
   - Email/Password
   - OAuth providers (Google, GitHub, etc.)
   - Magic links
   - SSO (optional)

## Get Your API Credentials

1. Navigate to **API Keys** in the WorkOS dashboard
2. Copy your API Key (starts with `sk_`)
3. Copy your Client ID (starts with `client_`)

## Configure Redirect URIs

1. In the WorkOS dashboard, go to **AuthKit** → **Redirects**
2. Add your redirect URIs:
   - Development: `http://localhost:3000/api/v1/auth/callback`
   - Production: `https://yourdomain.com/api/v1/auth/callback`

## Update Environment Variables

### Backend (.env)

```bash
WORKOS_API_KEY=sk_test_your_actual_api_key_here
WORKOS_CLIENT_ID=client_your_actual_client_id_here
WORKOS_REDIRECT_URI=http://localhost:3000/api/v1/auth/callback
```

### Frontend (.env)

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

For production, update both the backend redirect URI and frontend API URL to your production domain.

## Testing Authentication

1. Start your backend server: `cd backend && npm run dev`
2. Start your frontend app: `cd frontend && npm start`
3. In the app, tap the login button
4. You'll be redirected to WorkOS AuthKit
5. Complete authentication
6. You'll be redirected back to your app with a valid session

## Additional Resources

- [WorkOS Documentation](https://workos.com/docs)
- [WorkOS AuthKit Guide](https://workos.com/docs/user-management)
- [WorkOS Node.js SDK](https://workos.com/docs/reference/node)
