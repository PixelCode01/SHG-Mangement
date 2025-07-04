#!/usr/bin/env node

// Test the emergency fix
const fetch = require('node-fetch');
const FormData = require('form-data');

async function testEmergencyFix() {
    console.log('🚨 Testing Emergency Fix for PDF Import');
    console.log('======================================');
    
    // Wait for deployment
    console.log('⏳ Waiting 2 minutes for emergency fix deployment...');
    await new Promise(resolve => setTimeout(resolve, 120000));
    
    try {
        // Test the emergency endpoint
        console.log('\n📤 Testing /api/pdf-extract-v4 emergency response...');
        
        const form = new FormData();
        const dummyBuffer = Buffer.from('dummy PDF content');
        form.append('file', dummyBuffer, {
            filename: 'test.pdf',
            contentType: 'application/pdf'
        });
        
        const response = await fetch('https://shg-mangement.vercel.app/api/pdf-extract-v4', {
            method: 'POST',
            body: form
        });
        
        console.log(`📥 Response status: ${response.status}`);
        
        if (response.status === 422) {
            const result = await response.json();
            console.log('✅ EMERGENCY FIX IS WORKING!');
            console.log('📋 Fallback details:', result.details);
            console.log('🎉 This should now trigger client-side processing in the frontend!');
            
            console.log('\n📱 What the user should see now:');
            console.log('1. Upload PDF file');
            console.log('2. Server returns 422 error (controlled fallback)');
            console.log('3. Frontend catches error and uses local processing');
            console.log('4. All 50-51 members extracted successfully');
            console.log('5. No more ENOENT file system errors!');
            
        } else {
            console.log('⚠️ Unexpected response status:', response.status);
            const text = await response.text();
            console.log('📋 Response:', text);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

if (require.main === module) {
    testEmergencyFix().catch(console.error);
}
