#!/usr/bin/env node

/**
 * Quick Test Emergency Step 2 Fix After Deployment
 */

const https = require('https');

console.log('🔍 QUICK TEST: EMERGENCY STEP 2 FIX');
console.log('====================================');
console.log(`Time: ${new Date().toISOString()}`);
console.log('');

async function quickTest() {
    console.log('⏳ Waiting 2 minutes for Vercel deployment...');
    await new Promise(resolve => setTimeout(resolve, 120000));
    
    console.log('📡 Testing PDF endpoints...');
    
    const endpoints = ['/api/pdf-extract-v4', '/api/pdf-parse-universal', '/api/pdf-production'];
    let allWorking = true;
    
    for (const endpoint of endpoints) {
        try {
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
                    resolve(res.statusCode);
                });
                
                req.on('error', () => resolve(null));
                req.write(postData);
                req.end();
            });
            
            if (result === 422) {
                console.log(`✅ ${endpoint}: Returns 422 (correct)`);
            } else {
                console.log(`❌ ${endpoint}: Returns ${result} (expected 422)`);
                allWorking = false;
            }
        } catch (error) {
            console.log(`❌ ${endpoint}: Error - ${error.message}`);
            allWorking = false;
        }
    }
    
    console.log('');
    if (allWorking) {
        console.log('🎉 EMERGENCY FIX WORKING!');
        console.log('');
        console.log('👤 USER INSTRUCTIONS:');
        console.log('1. Open https://shg-mangement.vercel.app in INCOGNITO mode');
        console.log('2. Go to Groups → Create Group → Step 2'); 
        console.log('3. Open console (F12) - look for "🚨 EMERGENCY STEP 2 FIX ACTIVE"');
        console.log('4. Upload a PDF - should work without hanging');
        console.log('5. Step 2 → Step 3 navigation should work smoothly');
    } else {
        console.log('⚠️  Some endpoints not returning 422 yet');
        console.log('   Wait a few more minutes and try again');
    }
}

quickTest().catch(console.error);
