#!/usr/bin/env node

/**
 * Emergency Step 2 Fix - Force Proper Fallback Behavior
 * Ensures all legacy PDF endpoints return 422 to force client-side processing
 */

console.log('🚨 EMERGENCY STEP 2 FIX - FORCE PROPER FALLBACK');
console.log('===============================================');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('');

console.log('🔍 ISSUE IDENTIFIED:');
console.log('Legacy PDF endpoints are returning 200 instead of 422');
console.log('This prevents the frontend from using client-side fallback');
console.log('Result: Step 2 hangs because server-side PDF parsing fails');
console.log('');

console.log('🛠️  APPLYING EMERGENCY FIX:');
console.log('Updating all PDF endpoints to force 422 response');
console.log('');

const fs = require('fs');
const { execSync } = require('child_process');

// 1. Update package.json with emergency version
const packagePath = './package.json';
const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const emergencyVersion = `${packageData.version}-emergency-step2-fix-${Date.now()}`;
packageData.version = emergencyVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2));
console.log(`📦 Updated version to: ${emergencyVersion}`);

// 2. Create/update emergency PDF endpoint fixes
const emergencyResponses = `
import { NextRequest, NextResponse } from 'next/server';

// Emergency fix: Force all PDF endpoints to return 422
// This ensures frontend uses client-side processing only
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: "EMERGENCY_FIX: Server-side PDF parsing disabled - use client-side processing",
    fallbackRequired: true,
    emergencyFix: true,
    timestamp: new Date().toISOString()
  }, { status: 422 });
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: "EMERGENCY_FIX: Server-side PDF parsing disabled - use client-side processing", 
    fallbackRequired: true,
    emergencyFix: true,
    timestamp: new Date().toISOString()
  }, { status: 422 });
}
`;

// Apply fix to all problematic endpoints
const endpointsToFix = [
  'app/api/pdf-extract-v4/route.ts',
  'app/api/pdf-parse-universal/route.ts', 
  'app/api/pdf-production/route.ts'
];

endpointsToFix.forEach(endpoint => {
  if (fs.existsSync(endpoint)) {
    console.log(`🔧 Updating ${endpoint}`);
    fs.writeFileSync(endpoint, emergencyResponses);
  } else {
    console.log(`📁 Creating ${endpoint}`);
    // Create directory if it doesn't exist
    const dir = endpoint.substring(0, endpoint.lastIndexOf('/'));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(endpoint, emergencyResponses);
  }
});

// 3. Update the main component with better error handling
console.log('');
console.log('🔧 UPDATING COMPONENT ERROR HANDLING:');

const componentPath = 'app/components/MultiStepGroupForm.tsx';
if (fs.existsSync(componentPath)) {
  let componentContent = fs.readFileSync(componentPath, 'utf8');
  
  // Add emergency diagnostic logging
  const emergencyDiagnostic = `
  // 🚨 EMERGENCY STEP 2 FIX - Enhanced Logging
  useEffect(() => {
    console.log('🚨 EMERGENCY STEP 2 FIX ACTIVE - Component loaded');
    console.log('🚨 Version: ${emergencyVersion}');
    console.log('🚨 All PDF endpoints will return 422 to force client-side processing');
    console.log('🚨 If you see this message, the fix is deployed');
  }, []);
`;
  
  // Insert emergency logging after the existing useEffect
  componentContent = componentContent.replace(
    "console.log('🔍 CACHE BUST V7:",
    emergencyDiagnostic + "\n  console.log('🔍 CACHE BUST V7:"
  );
  
  fs.writeFileSync(componentPath, componentContent);
  console.log('✅ Component updated with emergency diagnostics');
} else {
  console.log('❌ Component file not found');
}

// 4. Build and deploy
console.log('');
console.log('🔨 BUILDING FOR EMERGENCY DEPLOYMENT:');

try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build successful');
  
  console.log('📤 DEPLOYING EMERGENCY FIX:');
  execSync('git add -A', { stdio: 'inherit' });
  execSync(`git commit -m "🚨 EMERGENCY: Fix Step 2 by forcing 422 responses on PDF endpoints

- Force all legacy PDF endpoints to return 422
- Ensures frontend uses client-side processing only  
- Prevents server-side PDF parsing failures
- Version: ${emergencyVersion}"`, { stdio: 'inherit' });
  
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('✅ Emergency fix deployed!');
  
  console.log('');
  console.log('⏳ DEPLOYMENT STATUS:');
  console.log(`Version: ${emergencyVersion}`);
  console.log('Expected live: 2-3 minutes');
  console.log('');
  console.log('🔍 VERIFICATION STEPS:');
  console.log('1. Wait 3 minutes for deployment');
  console.log('2. Open https://shg-mangement.vercel.app in incognito mode');
  console.log('3. Go to Groups → Create Group → Step 2');
  console.log('4. Check console for "🚨 EMERGENCY STEP 2 FIX ACTIVE"');
  console.log('5. Upload a PDF - should work without hanging');
  console.log('');
  console.log('🎯 EXPECTED RESULTS:');
  console.log('• Console shows emergency fix messages');
  console.log('• PDF upload completes successfully');
  console.log('• Step 2 → Step 3 navigation works');
  console.log('• No more 200 responses from PDF endpoints');
  
} catch (error) {
  console.error('❌ Emergency deployment failed:', error.message);
  console.log('');
  console.log('🔧 MANUAL DEPLOYMENT OPTION:');
  console.log('1. Run: npm run build');
  console.log('2. Run: git add -A');
  console.log('3. Run: git commit -m "Emergency Step 2 fix"');
  console.log('4. Run: git push origin main');
}

console.log('');
console.log('🚨 EMERGENCY FIX COMPLETE!');
console.log('This should resolve the Step 2 hanging issue by forcing client-side PDF processing.');
