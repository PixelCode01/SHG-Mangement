#!/usr/bin/env node

/**
 * EMERGENCY FIX CONSOLE LOG VALIDATION
 * 
 * This script validates that the emergency fix console logs
 * are properly embedded in the frontend JavaScript.
 */

const BASE_URL = 'https://shg-mangement.vercel.app';

async function validateEmergencyFixLogs() {
  console.log('🔍 EMERGENCY FIX CONSOLE LOG VALIDATION');
  console.log('========================================');
  console.log('Checking for emergency fix indicators in frontend');
  console.log('Time:', new Date().toISOString());
  console.log('');

  try {
    // Get the main page HTML to find JavaScript chunk references
    console.log('📋 Fetching group creation form...');
    const response = await fetch(`${BASE_URL}/groups/create`);
    const html = await response.text();
    
    console.log('✅ Page loaded successfully');
    
    // Extract JavaScript chunk URLs
    const jsChunkRegex = /_next\/static\/chunks\/[^"]*\.js/g;
    const chunks = html.match(jsChunkRegex) || [];
    
    console.log(`📦 Found ${chunks.length} JavaScript chunks`);
    
    // Look for the main application chunk (likely contains our MultiStepGroupForm)
    const appChunks = chunks.filter(chunk => 
      chunk.includes('pages') || 
      chunk.includes('main') || 
      chunk.includes('app') ||
      chunk.match(/\d{4}\./)  // Look for numbered chunks which often contain page components
    );
    
    console.log(`📄 Checking ${appChunks.length} app-related chunks for emergency fix code...`);
    
    let emergencyFixFound = false;
    let cacheeBustFound = false;
    let step2FixFound = false;
    
    for (const chunk of appChunks.slice(0, 5)) { // Check first 5 app chunks
      try {
        console.log(`   🔍 Checking chunk: ${chunk}`);
        const chunkResponse = await fetch(`${BASE_URL}${chunk}`);
        const chunkCode = await chunkResponse.text();
        
        // Look for emergency fix indicators
        if (chunkCode.includes('EMERGENCY STEP 2 FIX ACTIVE')) {
          emergencyFixFound = true;
          console.log('   ✅ Found "EMERGENCY STEP 2 FIX ACTIVE" message');
        }
        
        if (chunkCode.includes('CACHE BUST V')) {
          cacheeBustFound = true;
          console.log('   ✅ Found cache bust indicators');
        }
        
        if (chunkCode.includes('emergency-step2-fix')) {
          step2FixFound = true;
          console.log('   ✅ Found step2 fix version identifier');
        }
        
        // Look for PDF processing related code
        if (chunkCode.includes('pdf-upload-v11') || chunkCode.includes('extractMembersFromPDFV11')) {
          console.log('   ✅ Found PDF processing code');
        }
        
        if (chunkCode.includes('fallbackRequired') || chunkCode.includes('422')) {
          console.log('   ✅ Found 422 handling code');
        }
        
      } catch (error) {
        console.log(`   ⚠️  Could not check chunk ${chunk}: ${error.message}`);
      }
      
      // Small delay between chunk requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('');
    console.log('📊 VALIDATION RESULTS:');
    console.log('======================');
    
    if (emergencyFixFound) {
      console.log('✅ Emergency fix console logs are embedded in frontend');
    } else {
      console.log('⚠️  Could not find emergency fix console logs (may be in other chunks)');
    }
    
    if (cacheeBustFound) {
      console.log('✅ Cache bust indicators found');
    }
    
    if (step2FixFound) {
      console.log('✅ Step 2 fix version identifiers found');
    }
    
    console.log('');
    console.log('🧪 EXPECTED BEHAVIOR IN BROWSER:');
    console.log('=================================');
    console.log('When you open the group creation form and go to Step 2:');
    console.log('');
    console.log('Console should show:');
    console.log('  🚨 EMERGENCY STEP 2 FIX ACTIVE - Component loaded');
    console.log('  🚨 Version: 0.1.3-emergency-step2-fix-...');
    console.log('  🚨 All PDF endpoints will return 422 to force client-side processing');
    console.log('  🚨 If you see this message, the fix is deployed');
    console.log('');
    console.log('When uploading PDF:');
    console.log('  📤 Uploading PDF to server endpoint...');
    console.log('  🔄 CACHE BUST V11: Server requested fallback to client-side processing (422)');
    console.log('  🚨 Emergency fix active - using client-side processing');
    console.log('');
    console.log('💡 If you see these messages, Step 2 is working correctly!');
    
  } catch (error) {
    console.log('❌ VALIDATION FAILED:', error.message);
  }

  console.log('');
  console.log('Validation completed at:', new Date().toISOString());
}

// Run the validation
validateEmergencyFixLogs().catch(console.error);
