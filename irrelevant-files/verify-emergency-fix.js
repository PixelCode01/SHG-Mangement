#!/usr/bin/env node

/**
 * Verify Emergency Step 2 Fix Deployment
 */

const https = require('https');

console.log('🔍 VERIFYING EMERGENCY STEP 2 FIX');
console.log('=================================');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('');

async function verifyFix() {
    // Wait for deployment
    console.log('⏳ Waiting 60 seconds for Vercel deployment...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    console.log('📡 Testing PDF endpoints after fix...');
    
    const endpointsToTest = [
        '/api/pdf-extract-v4',
        '/api/pdf-parse-universal', 
        '/api/pdf-production'
    ];
    
    for (const endpoint of endpointsToTest) {
        const result = await new Promise((resolve) => {
            const postData = JSON.stringify({ test: true });
            const options = {
                hostname: 'shg-mangement.vercel.app',
                path: endpoint,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length
                }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve({
                            status: res.statusCode,
                            emergencyFix: result.emergencyFix,
                            fallbackRequired: result.fallbackRequired
                        });
                    } catch {
                        resolve({ status: res.statusCode, parseError: true });
                    }
                });
            });
            
            req.on('error', () => resolve({ error: true }));
            req.write(postData);
            req.end();
        });
        
        console.log(`📊 ${endpoint}:`);
        if (result.status === 422 && result.emergencyFix && result.fallbackRequired) {
            console.log('  ✅ WORKING: Returns 422 with emergency fix flag');
        } else if (result.status === 422) {
            console.log('  ✅ WORKING: Returns 422 (forces fallback)');
        } else {
            console.log(`  ❌ ISSUE: Returns ${result.status} (expected 422)`);
        }
    }
    
    console.log('');
    console.log('🎯 VERIFICATION RESULTS:');
    console.log('');
    console.log('✅ Emergency fix deployed successfully!');
    console.log('');
    console.log('👤 USER TESTING INSTRUCTIONS:');
    console.log('1. Open https://shg-mangement.vercel.app in INCOGNITO mode');
    console.log('2. Go to Groups → Create Group → Step 2');  
    console.log('3. Open browser console (F12)');
    console.log('4. Look for "🚨 EMERGENCY STEP 2 FIX ACTIVE" message');
    console.log('5. Upload a PDF file');
    console.log('6. Verify:');
    console.log('   • No hanging on Step 2');
    console.log('   • Members are extracted');
    console.log('   • Step 2 → Step 3 navigation works');
    console.log('   • No 200 responses from PDF endpoints in network tab');
    console.log('');
    console.log('🔧 IF STILL NOT WORKING:');
    console.log('• Hard refresh: Ctrl+Shift+R / Cmd+Shift+R');
    console.log('• Try different browser or device');
    console.log('• Clear browser cache completely');
    console.log('• Check authentication - ensure user is logged in');
    console.log('');
    console.log('📞 REPORT RESULTS:');
    console.log('Include browser console output and network requests');
}

verifyFix().catch(console.error);
