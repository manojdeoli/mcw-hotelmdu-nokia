# Setup Instructions

## Install Missing Dependency

Run this command in the project directory:

```bash
npm install node-fetch@2.6.7
```

## Start the Application

```bash
npm run dev
```

This will start:
- Backend server on port 3003
- React app on port 3000

## Authentication Flow

1. App loads → Auto-authenticates on first visit
2. OAuth redirect → Returns to app with code
3. Token exchange → App is authenticated
4. Verify phone number → Can now use all APIs

## Important Notes

- Authentication happens ONCE on first visit
- Token is validated before API calls
- No automatic re-authentication during API calls
- Clear localStorage to reset authentication state
