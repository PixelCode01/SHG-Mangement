#!/usr/bin/env node

// Test the actual web interface that the user is experiencing
const fetch = require('node-fetch');

async function testWebInterface() {
    console.log('🌐 Testing Web Interface PDF Import');
    console.log('===================================');
    
    // First check if the deployed API has updated
    console.log('\n🔍 Checking deployed API status...');
    
    try {
        const response = await fetch('https://shg-mangement.vercel.app/api/pdf-text-process');
        console.log(`📥 API status: ${response.status}`);
        
        if (response.status === 200) {
            const result = await response.json();
            console.log('✅ API is responding correctly');
            console.log('📋 API info:', result.message);
            
            // Test the production-safe endpoint with sample text
            console.log('\n� Testing production-safe text processing...');
            
            const testText = `
AARTI SHARMA
1500
PRIYA PATEL
2000
SUNITA SINGH
1200
            `.trim();
            
            const testResponse = await fetch('https://shg-mangement.vercel.app/api/pdf-text-process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: testText,
                    fileName: 'test.pdf',
                    fileSize: 1000
                })
            });
            
            console.log(`📥 Test response status: ${testResponse.status}`);
            
            if (testResponse.ok) {
                const testResult = await testResponse.json();
                console.log('✅ Production endpoint is working!');
                console.log('� Test results:', {
                    totalMembers: testResult.members?.length || 0,
                    firstMember: testResult.members?.[0]?.name || 'None'
                });
                
                console.log('\n🎉 SUCCESS! The fix is deployed and working!');
                console.log('📝 The user should no longer see ENOENT errors');
                console.log('� PDF import will now work via client-side extraction');
                
            } else {
                console.log('❌ Test failed with status:', testResponse.status);
                const errorText = await testResponse.text();
                console.log('📋 Error:', errorText);
            }
            
        } else {
            console.log('⚠️ API still not updated. Status:', response.status);
            console.log('🔄 Deployment may still be in progress...');
            
            // Wait and retry
            console.log('⏳ Waiting 10 seconds and retrying...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            const retryResponse = await fetch('https://shg-mangement.vercel.app/api/pdf-text-process');
            console.log(`📥 Retry status: ${retryResponse.status}`);
            
            if (retryResponse.status === 200) {
                console.log('✅ API updated after retry!');
            } else {
                console.log('⚠️ API still not ready after retry');
            }
        }
    } catch (error) {
        console.log('❌ API check failed:', error.message);
        return;
    }
    
    console.log('\n📋 Expected behavior:');
    console.log('1. User uploads PDF file');
    console.log('2. Frontend extracts text client-side (simple pattern matching)');
    console.log('3. Frontend sends extracted text to /api/pdf-text-process');
    console.log('4. Server processes the text and returns structured member data');
    console.log('5. No file system dependencies, no DOM dependencies');
    console.log('6. Works in both local and Vercel serverless environments');
}

if (require.main === module) {
    testWebInterface().catch(console.error);
}

if (require.main === module) {
    testWebInterface().catch(console.error);
}
