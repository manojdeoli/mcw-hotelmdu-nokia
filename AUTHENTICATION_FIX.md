# Authentication Refresh Loop Fix

## Problem
The application was continuously refreshing on first authentication because:
1. OAuth authentication was triggered on EVERY page load
2. No check for existing valid tokens before re-authenticating
3. No flag to prevent repeated authentication attempts
4. API calls would trigger re-authentication if token expired

## Solution Applied

### 1. Updated `auth.js` (Complete OAuth Implementation)
- Replaced incomplete OAuth flow with full implementation from healthcare project
- Added proper token validation with `isTokenValid()` method
- Implemented session storage for OAuth state during redirect
- Added proper callback handling with `checkAndHandleCallback()`

### 2. Updated `App.js` Authentication Logic
**Before:**
```javascript
useEffect(() => {
  const initAuth = async () => {
    try {
      const hasToken = await authService.checkAndHandleCallback();
      if (hasToken) {
        setIsAuthenticated(true);
      } else {
        await authService.authenticate(); // ❌ Always authenticates
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthenticating(false);
    }
  };
  initAuth();
}, []);
```

**After:**
```javascript
useEffect(() => {
  const checkAuth = async () => {
    // 1. Check if returning from OAuth callback
    const authResult = await authService.checkAndHandleCallback();
    if (authResult) {
      if (authResult.success) {
        setIsAuthenticated(true);
        localStorage.setItem('has_authenticated', 'true'); // ✅ Set flag
      }
      return;
    }
    
    // 2. Check if token is still valid
    if (authService.isAuthenticated()) {
      setIsAuthenticated(true);
      return;
    }
    
    // 3. Only authenticate on first visit
    const hasAuthenticated = localStorage.getItem('has_authenticated');
    if (!hasAuthenticated) {
      // Auto-authenticate only once
      await authService.authenticate('+99999991000');
    }
  };
  checkAuth();
}, []);
```

### 3. Updated `api.js` Token Validation
**Before:**
```javascript
async function ensureValidToken() {
  if (authService.isTokenValid()) {
    return Promise.resolve();
  }
  await authService.authenticate(); // ❌ Triggers re-auth during API calls
  return new Promise(() => {});
}
```

**After:**
```javascript
async function ensureValidToken() {
  if (authService.isTokenValid()) {
    return Promise.resolve();
  }
  // ✅ Throw error instead of re-authenticating
  throw new Error('Token expired. Please refresh the page to re-authenticate.');
}
```

### 4. Fixed Token Expiry Handler
**Before:**
```javascript
if (seconds <= 0) {
  setIsAuthenticated(false);
  authService.authenticate(); // ❌ Auto re-authenticates
}
```

**After:**
```javascript
if (seconds <= 0) {
  setIsAuthenticated(false); // ✅ Just set state, let user refresh
}
```

## Authentication Flow

### First Visit
1. App loads → No `has_authenticated` flag found
2. Auto-authenticate with default phone number
3. Redirect to OAuth provider
4. Return with code → Exchange for token
5. Set `has_authenticated` flag
6. User can now verify phone and use app

### Subsequent Visits
1. App loads → `has_authenticated` flag exists
2. Check if token is still valid
3. If valid → Restore authentication state
4. If expired → User sees "not authenticated" state
5. User can manually refresh to re-authenticate

### Number Verification
- Only called AFTER authentication is complete
- Token must be valid before calling Number Verification API
- If token expires during use, error is shown (no auto re-auth)

## Key Changes Summary
✅ Authentication only happens ONCE on first visit
✅ Token validity checked before re-authenticating
✅ OAuth callback properly handled without triggering new auth
✅ Number Verification called only after authentication complete
✅ No automatic re-authentication during API calls
✅ Clean separation between auth state and API calls

## Testing
1. Clear browser storage (localStorage + sessionStorage)
2. Load application → Should authenticate once
3. Complete OAuth flow → Should not refresh
4. Verify phone number → Should work without re-auth
5. Refresh page → Should restore auth state without re-authenticating
