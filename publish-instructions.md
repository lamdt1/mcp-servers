# How to Fix npm Publish 403 Error

## The Issue
The 403 error is caused by authentication problems. npm has revoked classic tokens and now requires:
- Granular access tokens (limited to 90 days)
- 2FA enabled by default

## Solution: Re-authenticate

### Option 1: Login via Browser (Recommended)
1. Run this command in PowerShell:
   ```powershell
   npm login
   ```
2. A browser window will open - complete the login there
3. If 2FA is enabled, you'll need to enter the code
4. Once logged in, try publishing:
   ```powershell
   npm publish
   ```

### Option 2: Create a Granular Access Token
1. Go to https://www.npmjs.com/settings/lamdt/tokens
2. Click "Generate New Token"
3. Select "Granular" token type
4. Set permissions: Read and Write packages
5. Copy the token
6. Set it in PowerShell:
   ```powershell
   npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN_HERE
   ```
7. Then publish:
   ```powershell
   npm publish
   ```

## Package Changes Made
- Changed package name to `@lamdt/mp3-mcp-server` (scoped package)
- Added `publishConfig` with `"access": "public"` for scoped packages
- This ensures the package is publicly accessible

## Verify Authentication
After logging in, verify with:
```powershell
npm whoami
```

You should see: `lamdt`

