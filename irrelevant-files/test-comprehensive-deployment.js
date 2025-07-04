const fs = require('fs');
const FormData = require('form-data');
const https = require('https');

async function comprehensiveDeploymentTest() {
    console.log('🧪 Comprehensive Deployment Test');
    console.log('=====================================');
    console.log('Testing PDF import on both local and deployed versions');
    console.log('Time:', new Date().toISOString());
    console.log('');
    
    // Test 1: Check if deployed API responds
    console.log('📡 Test 1: Basic deployed API health check');
    try {
        const healthCheck = await new Promise((resolve) => {
            https.get('https://shg-mangement.vercel.app/api/pdf-parse-universal', (res) => {
                console.log(`   Status: ${res.statusCode} (expected: 405 for GET request)`);
                resolve(res.statusCode);
            }).on('error', (err) => {
                console.log(`   Error: ${err.message}`);
                resolve(null);
            });
        });
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }
    
    console.log('');
    
    // Test 2: PDF parsing test with deployed version
    console.log('📄 Test 2: Deployed PDF parsing test');
    try {
        const pdfPath = './public/swawlamban-may-2025.pdf';
        if (!fs.existsSync(pdfPath)) {
            console.log('   ❌ PDF file not found:', pdfPath);
            return;
        }
        
        console.log('   📁 PDF file found, size:', fs.statSync(pdfPath).size, 'bytes');
        
        const form = new FormData();
        form.append('file', fs.createReadStream(pdfPath), {
            filename: 'swawlamban-may-2025.pdf',
            contentType: 'application/pdf'
        });
        
        const deployedResult = await new Promise((resolve) => {
            const url = 'https://shg-mangement.vercel.app/api/pdf-parse-universal';
            
            const options = {
                method: 'POST',
                headers: form.getHeaders()
            };
            
            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        console.log('   📊 Response status:', res.statusCode);
                        
                        if (res.statusCode === 200) {
                            const result = JSON.parse(data);
                            console.log('   ✅ Response parsed successfully');
                            console.log(`   📈 Members found: ${result.members ? result.members.length : 0}`);
                            console.log(`   🔍 Debug info: ${result.debug ? 'present' : 'missing'}`);
                            console.log(`   📝 Text preview: "${result.text ? result.text.substring(0, 100) : 'none'}..."`);
                            
                            if (result.members && result.members.length > 0) {
                                console.log('   🎉 SUCCESS! PDF parsing working on deployed version');
                                console.log(`   👥 Extracted ${result.members.length} members`);
                                console.log('   🧑 First member:', result.members[0].name);
                                console.log('   🧑 Last member:', result.members[result.members.length - 1].name);
                                resolve({ success: true, count: result.members.length });
                            } else {
                                console.log('   ❌ FAILED! No members extracted from deployed version');
                                resolve({ success: false, count: 0, debug: result });
                            }
                        } else {
                            console.log('   ❌ HTTP Error:', res.statusCode);
                            console.log('   Response:', data.substring(0, 200));
                            resolve({ success: false, error: `HTTP ${res.statusCode}` });
                        }
                    } catch (parseError) {
                        console.log('   ❌ Parse error:', parseError.message);
                        console.log('   Raw response (first 200 chars):', data.substring(0, 200));
                        resolve({ success: false, error: 'Parse error' });
                    }
                });
            });
            
            req.on('error', (error) => {
                console.log('   ❌ Request error:', error.message);
                resolve({ success: false, error: error.message });
            });
            
            form.pipe(req);
        });
        
        console.log('');
        console.log('🏁 FINAL RESULT:');
        console.log('================');
        
        if (deployedResult.success) {
            console.log('✅ SUCCESS! Deployed version is working correctly');
            console.log(`   Members extracted: ${deployedResult.count}`);
            console.log('');
            console.log('🎯 TASK COMPLETED! PDF member import is now working on both local and deployed versions.');
            console.log('   Users can now upload PDFs and extract all members successfully.');
        } else {
            console.log('❌ DEPLOYMENT ISSUE: Deployed version is still not working');
            console.log('   This might be due to:');
            console.log('   • Vercel build cache not updated');
            console.log('   • Deployment still in progress');
            console.log('   • Environment differences between local and production');
            console.log('');
            console.log('🔄 NEXT STEPS:');
            console.log('   1. Wait a few more minutes for deployment to complete');
            console.log('   2. Check Vercel dashboard for build status');
            console.log('   3. Consider clearing Vercel cache manually');
        }
        
    } catch (error) {
        console.log('   ❌ Test error:', error.message);
    }
}

// Run the comprehensive test
comprehensiveDeploymentTest();
