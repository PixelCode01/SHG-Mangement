# Cache Bust Deployment

## Deployment Details
- **Timestamp**: 2025-06-15T14:04:40.973Z
- **Deploy ID**: DEPLOY_1749996280973_4bqa9vzxo
- **Version**: 0.1.2
- **Purpose**: Force deployment of PDF.js client-side extraction fix

## Changes
- PDF extraction now uses proper PDF.js client-side processing
- No server-side PDF file processing (production-safe)
- All PDF endpoints return 422 to force client-side fallback
- Enhanced error handling and debugging

## Status
This deployment forces cache invalidation to ensure users get the latest PDF extraction code.
