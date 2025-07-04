#!/usr/bin/env node

/**
 * Comprehensive Step 2 Issue Diagnosis Script
 * Identifies why group form import member step 2 is not working in deployed Vercel version
 */

const https = require('https');
const fs = require('fs');

console.log('🔍 GROUP FORM IMPORT MEMBER STEP 2 - DEPLOYMENT DIAGNOSIS');
console.log('=======================================================');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('');

async function diagnosisReport() {
    try {
        // 1. Check deployment status
        console.log('📡 1. DEPLOYMENT STATUS CHECK');
        console.log('----------------------------');
        
        const deploymentCheck = await new Promise((resolve) => {
            const req = https.get('https://shg-mangement.vercel.app/groups/create', (res) => {
                console.log(`✅ Site accessible: ${res.statusCode}`);
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    // Check for bundle hash to detect new deployments
                    const bundleMatch = data.match(/chunks\/(\w+)\.js/);
                    if (bundleMatch) {
                        console.log(`📦 Current bundle hash: ${bundleMatch[1]}`);
                    }
                    
                    // Check for component version indicators
                    if (data.includes('v7') || data.includes('CACHE_BUST')) {
                        console.log('✅ New code deployed (version markers found)');
                    } else {
                        console.log('⚠️  May be old cached version');
                    }
                    resolve(true);
                });
            });
            req.on('error', () => resolve(false));
        });

        console.log('');

        // 2. Test API endpoints
        console.log('🌐 2. API ENDPOINTS TEST');
        console.log('------------------------');
        
        // Test member creation API
        const memberAPITest = await new Promise((resolve) => {
            const postData = JSON.stringify({
                name: 'Test Member Diagnosis',
                email: 'diagnosis@test.com',
                allowDuplicates: true
            });
            
            const options = {
                hostname: 'shg-mangement.vercel.app',
                path: '/api/members?allowDuplicates=true',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length
                }
            };
            
            const req = https.request(options, (res) => {
                console.log(`📊 Members API status: ${res.statusCode}`);
                if (res.statusCode === 401) {
                    console.log('⚠️  Authentication required - this is normal for member creation');
                } else if (res.statusCode === 201) {
                    console.log('✅ Member creation working');
                } else {
                    console.log(`❓ Unexpected status: ${res.statusCode}`);
                }
                resolve(res.statusCode);
            });
            
            req.on('error', (error) => {
                console.log('❌ Members API error:', error.message);
                resolve(null);
            });
            
            req.write(postData);
            req.end();
        });

        console.log('');

        // 3. Test PDF processing (the main issue)
        console.log('📄 3. PDF PROCESSING TEST');
        console.log('-------------------------');
        
        const pdfTestData = JSON.stringify({
            text: `MEMBER LIST
            SUNITA DEVI    25000
            KAMLA DEVI     15000
            RITA SHARMA    30000`,
            fileName: 'diagnosis-test.pdf',
            fileSize: 12345
        });
        
        const pdfAPITest = await new Promise((resolve) => {
            const options = {
                hostname: 'shg-mangement.vercel.app',
                path: '/api/pdf-text-process',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': pdfTestData.length
                }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    console.log(`📊 PDF API status: ${res.statusCode}`);
                    
                    if (res.statusCode === 200) {
                        try {
                            const result = JSON.parse(data);
                            console.log(`✅ PDF processing working: ${result.members?.length || 0} members found`);
                            if (result.members && result.members.length > 0) {
                                console.log(`📋 Sample: ${result.members[0].name} - ₹${result.members[0].loanAmount}`);
                            }
                        } catch (e) {
                            console.log('❌ PDF API response parsing failed');
                        }
                    } else {
                        console.log(`❌ PDF API failed: ${res.statusCode}`);
                        console.log('Response preview:', data.substring(0, 200));
                    }
                    resolve(res.statusCode);
                });
            });
            
            req.on('error', (error) => {
                console.log('❌ PDF API error:', error.message);
                resolve(null);
            });
            
            req.write(pdfTestData);
            req.end();
        });

        console.log('');

        // 4. Check known problematic endpoints
        console.log('🚫 4. LEGACY ENDPOINTS CHECK');
        console.log('----------------------------');
        
        const legacyEndpoints = [
            '/api/pdf-extract-v4',
            '/api/pdf-parse-universal',
            '/api/pdf-production'
        ];
        
        for (const endpoint of legacyEndpoints) {
            const endpointTest = await new Promise((resolve) => {
                const req = https.get(`https://shg-mangement.vercel.app${endpoint}`, (res) => {
                    console.log(`📡 ${endpoint}: ${res.statusCode}`);
                    if (res.statusCode === 422) {
                        console.log('  ✅ Correctly returns 422 (forces client-side fallback)');
                    } else if (res.statusCode === 405) {
                        console.log('  ✅ Method not allowed (expected for GET)');
                    } else {
                        console.log(`  ⚠️  Unexpected status: ${res.statusCode}`);
                    }
                    resolve(res.statusCode);
                });
                req.on('error', () => resolve(null));
            });
        }

        console.log('');

        // 5. Provide diagnosis summary
        console.log('🎯 5. DIAGNOSIS SUMMARY');
        console.log('-----------------------');
        
        console.log('The Step 2 issue is likely caused by one of these factors:');
        console.log('');
        
        console.log('📱 FRONTEND CACHE ISSUES:');
        console.log('  • Browser is serving cached JavaScript from old deployment');
        console.log('  • Old code still tries to call /api/pdf-extract-v4 which returns 422');
        console.log('  • Fallback mechanism may not be working in cached code');
        console.log('');
        
        console.log('🔐 AUTHENTICATION ISSUES:');
        console.log('  • Step 2 member creation requires authentication');
        console.log('  • User may not be logged in or session may have expired');
        console.log('  • Different auth state between local and deployed environments');
        console.log('');
        
        console.log('🌐 DEPLOYMENT SYNC ISSUES:');
        console.log('  • Vercel may still be serving old cached content');
        console.log('  • New JavaScript bundle not yet propagated globally');
        console.log('  • CDN cache invalidation may be incomplete');
        console.log('');
        
        console.log('🔧 IMMEDIATE FIXES TO TRY:');
        console.log('1. **HARD REFRESH**: Ctrl+Shift+R or Cmd+Shift+R');
        console.log('2. **INCOGNITO MODE**: Open site in private/incognito browser');
        console.log('3. **CHECK AUTH**: Ensure user is logged in on deployed site');
        console.log('4. **CONSOLE CHECK**: Look for "CACHE BUST V7" messages in browser console');
        console.log('5. **WAIT**: Allow 2-3 more minutes for deployment propagation');
        console.log('');
        
        console.log('💡 EXPECTED BEHAVIOR WHEN FIXED:');
        console.log('• Step 2 PDF upload shows "CACHE BUST V7" messages in console');
        console.log('• No 422 errors from /api/pdf-extract-v4');
        console.log('• Member creation proceeds to Step 3 without hanging');
        console.log('• All imported members appear in Step 3 selection');
        console.log('');
        
        console.log('📞 IF ISSUE PERSISTS:');
        console.log('• Check browser console for specific error messages');
        console.log('• Verify authentication status on deployed site');
        console.log('• Try different browser or device');
        console.log('• Report exact console output and network request failures');

    } catch (error) {
        console.error('❌ Diagnosis failed:', error.message);
    }
}

// Run diagnosis
diagnosisReport().catch(console.error);
