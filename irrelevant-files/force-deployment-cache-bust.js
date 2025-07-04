#!/usr/bin/env node

/**
 * Force Deployment and Cache Bust
 * This script ensures new code gets deployed and caches are cleared
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Force Deployment and Cache Bust Script');
console.log('==========================================');

try {
  // 1. Update package.json version to force cache invalidation
  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentVersion = packageJson.version;
  const versionParts = currentVersion.split('.');
  versionParts[2] = (parseInt(versionParts[2]) + 1).toString(); // Increment patch version
  const newVersion = versionParts.join('.');
  
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  
  console.log(`📦 Updated package.json version: ${currentVersion} → ${newVersion}`);
  
  // 2. Create a cache-busting file
  const cacheBustFile = path.join(__dirname, 'CACHE_BUST_DEPLOY.md');
  const timestamp = new Date().toISOString();
  const deployId = `DEPLOY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  fs.writeFileSync(cacheBustFile, `# Cache Bust Deployment

## Deployment Details
- **Timestamp**: ${timestamp}
- **Deploy ID**: ${deployId}
- **Version**: ${newVersion}
- **Purpose**: Force deployment of PDF.js client-side extraction fix

## Changes
- PDF extraction now uses proper PDF.js client-side processing
- No server-side PDF file processing (production-safe)
- All PDF endpoints return 422 to force client-side fallback
- Enhanced error handling and debugging

## Status
This deployment forces cache invalidation to ensure users get the latest PDF extraction code.
`);
  
  console.log(`📝 Created cache bust file: ${deployId}`);
  
  // 3. Verify the build works
  console.log('🔨 Building application to verify...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build successful');
  
  // 4. Git operations
  console.log('📝 Committing changes...');
  execSync('git add -A', { stdio: 'inherit' });
  execSync(`git commit -m "Force deployment cache bust ${deployId}

- Update package version to ${newVersion}
- Add cache bust deployment marker
- Ensure PDF.js client-side extraction code is deployed
- Clear any cached JavaScript with old server-side PDF calls"`, { stdio: 'inherit' });
  
  console.log('🚀 Pushing to trigger deployment...');
  execSync('git push origin main', { stdio: 'inherit' });
  
  console.log('✅ Force deployment complete!');
  console.log(`🌐 Deployment ID: ${deployId}`);
  console.log('📊 Monitor Vercel dashboard for deployment status');
  console.log('🔍 Check browser console for new log messages after deployment');
  
} catch (error) {
  console.error('❌ Force deployment failed:', error);
  process.exit(1);
}
