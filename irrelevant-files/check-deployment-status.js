#!/usr/bin/env node

// Test if the new frontend deployment is live
const { exec } = require('child_process');

async function checkDeploymentStatus() {
    console.log('🔍 Checking Frontend Deployment Status');
    console.log('=====================================');
    
    console.log('⏳ Waiting 30 seconds for deployment to start...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    for (let attempt = 1; attempt <= 10; attempt++) {
        console.log(`\n🔄 Attempt ${attempt}/10: Checking deployment...`);
        
        try {
            // Check if new frontend bundle is deployed by looking for our cache-busting logs
            const response = await fetch('https://shg-mangement.vercel.app/');
            const html = await response.text();
            
            console.log(`📥 Response status: ${response.status}`);
            
            // Look for bundle file changes (different hash)
            const bundleMatch = html.match(/5695\.([a-f0-9]+)\.js/);
            if (bundleMatch) {
                const bundleHash = bundleMatch[1];
                console.log(`📦 Current bundle hash: ${bundleHash}`);
                
                if (bundleHash !== 'f5803ddc43ea42b1') {
                    console.log('✅ NEW BUNDLE DETECTED! Frontend has been updated');
                    console.log('🎉 The PDF import fix should now be live');
                    console.log('\n📋 User should now see:');
                    console.log('   - "PRODUCTION-SAFE PDF PROCESSING - v2.0" in console');
                    console.log('   - "NO MORE FILE SYSTEM ERRORS" message');
                    console.log('   - All 50-51 members extracted successfully');
                    console.log('   - No more ENOENT file system errors');
                    return;
                } else {
                    console.log('⚠️ Still serving old bundle (f5803ddc43ea42b1)');
                }
            } else {
                console.log('⚠️ Could not find bundle hash in HTML');
            }
            
        } catch (error) {
            console.log(`❌ Check failed: ${error.message}`);
        }
        
        if (attempt < 10) {
            console.log('⏳ Waiting 30 seconds before next check...');
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }
    
    console.log('\n⚠️ Deployment may still be in progress');
    console.log('🔄 Manual check: Look for new bundle hash in browser dev tools');
}

checkDeploymentStatus().catch(console.error);
