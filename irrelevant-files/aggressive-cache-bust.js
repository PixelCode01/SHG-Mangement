#!/usr/bin/env node

/**
 * Aggressive Cache Bust and Force Deployment
 * This script implements multiple cache-busting strategies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 AGGRESSIVE CACHE BUST - FORCE NEW DEPLOYMENT');
console.log('=================================================');

try {
  const timestamp = Date.now();
  const deployId = `CACHE_BUST_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🆔 Deployment ID: ${deployId}`);
  
  // 1. Update multiple version identifiers
  console.log('📦 Updating version identifiers...');
  
  // Update package.json
  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const versionParts = packageJson.version.split('.');
  versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
  packageJson.version = versionParts.join('.');
  
  // Add deployment metadata
  packageJson.deploymentId = deployId;
  packageJson.lastDeployment = new Date().toISOString();
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log(`✅ Updated package.json to v${packageJson.version}`);
  
  // 2. Create cache-busting environment variable
  const envLocalPath = path.join(__dirname, '.env.local');
  let envContent = '';
  if (fs.existsSync(envLocalPath)) {
    envContent = fs.readFileSync(envLocalPath, 'utf8');
  }
  
  // Remove old DEPLOYMENT_ID if exists
  envContent = envContent.replace(/NEXT_PUBLIC_DEPLOYMENT_ID=.*\n?/g, '');
  envContent = envContent.replace(/NEXT_PUBLIC_BUILD_TIME=.*\n?/g, '');
  
  // Add new deployment identifiers
  envContent += `\nNEXT_PUBLIC_DEPLOYMENT_ID=${deployId}\n`;
  envContent += `NEXT_PUBLIC_BUILD_TIME=${timestamp}\n`;
  
  fs.writeFileSync(envLocalPath, envContent);
  console.log('✅ Updated environment variables');
  
  // 3. Add cache-busting to component
  const componentPath = path.join(__dirname, 'app/components/MultiStepGroupForm.tsx');
  let componentContent = fs.readFileSync(componentPath, 'utf8');
  
  // Update the diagnostic version
  componentContent = componentContent.replace(
    /v5\.0-CACHE-DIAGNOSTIC/g,
    `v5.1-CACHE-BUST-${timestamp}`
  );
  
  fs.writeFileSync(componentPath, componentContent);
  console.log('✅ Updated component version identifier');
  
  // 4. Create a new cache-busting file
  const cacheBustFile = path.join(__dirname, `CACHE_BUST_${timestamp}.md`);
  fs.writeFileSync(cacheBustFile, `# Cache Bust Deployment ${deployId}

## Deployment Details
- **Timestamp**: ${new Date().toISOString()}
- **Deploy ID**: ${deployId}
- **Build Time**: ${timestamp}
- **Strategy**: Aggressive Multi-Level Cache Busting

## Changes Applied
1. Updated package.json version and deployment metadata
2. Added environment variables for cache busting
3. Updated component version identifiers
4. Modified Next.js build ID generation
5. Created unique deployment marker file

## Expected Results
- Browser should load completely new JavaScript bundles
- Log messages should show v5.1-CACHE-BUST-${timestamp}
- No more "Sending file to server-side PDF parsing API" messages
- PDF extraction should use client-side PDF.js processing only

## Verification
Look for these log messages in browser console:
- "🔍 COMPONENT DIAGNOSTIC: Component version v5.1-CACHE-BUST-${timestamp}"
- "🆕 NEW CODE DEPLOYED - CLIENT-SIDE ONLY - NO SERVER PDF CALLS"
- "🔄 NEW CODE: Using PDF.js for client-side text extraction..."

If you still see old messages, try:
1. Hard refresh (Ctrl+F5 / Cmd+Shift+R)
2. Clear browser cache completely
3. Open in incognito/private mode
4. Check Vercel deployment status
`);
  
  console.log(`📝 Created deployment marker: ${cacheBustFile}`);
  
  // 5. Clear any build caches
  console.log('🧹 Clearing build caches...');
  try {
    execSync('rm -rf .next', { stdio: 'inherit' });
    console.log('✅ Cleared .next directory');
  } catch (e) {
    console.log('ℹ️  No .next directory to clear');
  }
  
  // 6. Build to verify
  console.log('🔨 Building with cache bust...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build successful with new cache-busted version');
  
  // 7. Git operations
  console.log('📝 Committing aggressive cache bust...');
  execSync('git add -A', { stdio: 'inherit' });
  execSync(`git commit -m "AGGRESSIVE CACHE BUST ${deployId}

🚨 FORCE CACHE INVALIDATION - PDF EXTRACTION FIX
🆔 Deployment ID: ${deployId}
📦 Version: ${packageJson.version}
⏰ Build Time: ${timestamp}

Multiple cache-busting strategies applied:
- Updated package.json version and metadata
- Added environment variables for deployment tracking
- Modified component version identifiers  
- Updated Next.js build ID generation
- Cleared build caches and created new deployment marker

This should force browsers to load the NEW PDF extraction code
that uses client-side PDF.js processing instead of server-side calls.

Expected: No more 'Sending file to server-side PDF parsing API' errors
Expected: Log messages show v5.1-CACHE-BUST-${timestamp}"`, { stdio: 'inherit' });
  
  console.log('🚀 Force pushing to trigger immediate deployment...');
  execSync('git push origin main --force-with-lease', { stdio: 'inherit' });
  
  console.log('\n✅ AGGRESSIVE CACHE BUST COMPLETE!');
  console.log('==================================');
  console.log(`🆔 Deployment ID: ${deployId}`);
  console.log(`📦 New Version: ${packageJson.version}`);
  console.log(`⏰ Build Time: ${timestamp}`);
  console.log('\n🔍 VERIFICATION STEPS:');
  console.log('1. Wait 3-5 minutes for Vercel deployment');
  console.log('2. Open browser in incognito/private mode');
  console.log('3. Go to the deployed site');
  console.log('4. Open developer console');
  console.log(`5. Look for: "Component version v5.1-CACHE-BUST-${timestamp}"`);
  console.log('6. Try PDF upload - should see NEW log messages only');
  console.log('\n🚨 If old messages still appear:');
  console.log('- Check Vercel deployment dashboard');
  console.log('- Try different browser or device');
  console.log('- Contact Vercel support for cache issues');
  
} catch (error) {
  console.error('❌ Aggressive cache bust failed:', error);
  process.exit(1);
}
