# PDF Import Step 2 Fix - Cache Bust V6

## Issue Summary
The group form import member step 2 was not working in the deployed Vercel version due to cached JavaScript code still calling the old `/api/pdf-extract-v4` endpoint, which returns a 422 error to force client-side fallback.

## Root Cause
- Browser was loading cached JavaScript that still contained old PDF processing code
- The old code was calling `/api/pdf-extract-v4` endpoint
- The endpoint intentionally returns 422 with `fallbackRequired: true` 
- However, the old cached code wasn't properly handling the fallback mechanism

## Error Logs Observed
```
POST https://shg-mangement.vercel.app/api/pdf-extract-v4 422 (Unprocessable Content)
PDF parse API error: {"success":false,"error":"Server-side PDF parsing unavailable - triggering client-side fallback","details":"CONTROLLED_FALLBACK: Forcing client-side processing to avoid file system issues","fallbackRequired":true,"emergencyFix":true}
```

## Solution Applied

### 1. Function Name Change (Cache Bust)
- Renamed `extractMembersFromPDF` to `extractMembersFromPDFV6`
- This forces browsers to load the new function instead of cached version

### 2. Enhanced Logging
- Added "CACHE BUST V6" prefix to all new log messages
- Clear differentiation between old cached and new code

### 3. Build Cache Clearing
- Created `force-cache-bust.sh` script to clear `.next` build cache
- Updated build ID in `next.config.ts` to `v6-pdf-fix`
- Added no-cache headers for JavaScript chunk files

### 4. Client-Side Only Processing
The new function:
- Uses PDF.js for client-side text extraction only
- Never calls `/api/pdf-extract-v4` endpoint
- Sends extracted text to `/api/pdf-text-process` for member parsing
- Has proper fallback mechanisms for PDF processing failures

## Files Modified

1. **app/components/MultiStepGroupForm.tsx**
   - Renamed function to `extractMembersFromPDFV6`
   - Enhanced diagnostic logging
   - Updated function call reference

2. **next.config.ts**
   - Updated build ID to force cache refresh
   - Added no-cache headers for JavaScript files

3. **force-cache-bust.sh** (new)
   - Script to clear build cache before deployment

## Deployment Instructions

1. **Deploy with Force Rebuild**:
   ```bash
   # Run cache bust script (already done)
   ./force-cache-bust.sh
   
   # Deploy to Vercel (force rebuild)
   vercel --prod --force
   ```

2. **User Instructions**:
   - Users may need to hard refresh browser (Ctrl+Shift+R)
   - Clear browser cache if old behavior persists

## Expected Behavior After Fix

### New Log Messages (Success):
```
🔍 CACHE BUST V6: MultiStepGroupForm loaded
🚀 CACHE BUST V6: EXTRACTING MEMBERS FROM PDF: members.pdf, size: 89974 bytes
🔄 CACHE BUST V6: Using PDF.js for client-side text extraction...
🚫 CACHE BUST V6: NEVER CALLING /api/pdf-extract-v4 ENDPOINT!
```

### Old Log Messages (Indicates Cache Issue):
```
Sending file to server-side PDF parsing API...
Using fixed universal PDF parser
POST https://shg-mangement.vercel.app/api/pdf-extract-v4 422
```

## Testing Verification

1. **Check Console Logs**: Should see "CACHE BUST V6" messages
2. **No 422 Errors**: Should not see calls to `/api/pdf-extract-v4`
3. **PDF Processing**: Should successfully extract members from PDF files
4. **Step 2 Navigation**: Should proceed to step 2 after PDF upload

## Rollback Plan

If issues persist:
1. Restore original function name
2. Revert next.config.ts changes
3. Check for other caching mechanisms

## Status: ✅ READY FOR DEPLOYMENT
Cache bust mechanisms implemented, function renamed, and logging enhanced to force browser refresh of JavaScript code.
