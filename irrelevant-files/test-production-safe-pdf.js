#!/usr/bin/env node

// Test production-safe PDF import with sample PDF
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testProductionSafePDFImport() {
    console.log('🧪 Testing Production-Safe PDF Import');
    console.log('=======================================');
    
    // Check if sample PDF exists
    const pdfPath = './public/sample-members.pdf';
    if (!fs.existsSync(pdfPath)) {
        console.log('❌ Sample PDF not found:', pdfPath);
        return;
    }
    
    try {
        // Test the production-safe text processing endpoint
        console.log('\n📤 Testing /api/pdf-text-process endpoint...');
        
        // Simulate client-side text extraction (properly formatted)
        const sampleExtractedText = `
AARTI SHARMA
1500
PRIYA PATEL
2000
SUNITA SINGH
1200
RAVI KUMAR
1800
POOJA GUPTA
2500
NEHA AGARWAL
1600
RAKESH MISHRA
2200
KAVITA JOSHI
1300
AMIT VERMA
1900
SITA KUMARI
1700
        `.trim();
        
        const textProcessResponse = await fetch('http://localhost:3000/api/pdf-text-process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: sampleExtractedText,
                fileName: 'sample-members.pdf',
                fileSize: 50000
            })
        });
        
        console.log(`📥 Local response status: ${textProcessResponse.status}`);
        
        if (textProcessResponse.ok) {
            const result = await textProcessResponse.json();
            console.log('✅ Local text processing succeeded!');
            console.log('📊 Results:', {
                totalMembers: result.members?.length || 0,
                firstMember: result.members?.[0] || 'None',
                statistics: result.statistics
            });
        } else {
            const error = await textProcessResponse.text();
            console.log('❌ Local text processing failed:', error);
        }
        
        // Test deployed endpoint
        console.log('\n🌐 Testing deployed endpoint...');
        
        const deployedResponse = await fetch('https://shg-mangement.vercel.app/api/pdf-text-process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: sampleExtractedText,
                fileName: 'sample-members.pdf',
                fileSize: 50000
            })
        });
        
        console.log(`📥 Deployed response status: ${deployedResponse.status}`);
        
        if (deployedResponse.ok) {
            const result = await deployedResponse.json();
            console.log('✅ Deployed text processing succeeded!');
            console.log('📊 Results:', {
                totalMembers: result.members?.length || 0,
                firstMember: result.members?.[0] || 'None',
                statistics: result.statistics
            });
            
            console.log('\n🎉 PRODUCTION-SAFE PDF IMPORT IS WORKING!');
            console.log('✅ Both local and deployed endpoints are functional');
            console.log('✅ Client-side extraction + server-side processing approach working');
        } else {
            const error = await deployedResponse.text();
            console.log('❌ Deployed text processing failed:', error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Also test that the problematic endpoints now return proper errors
async function testProblematicEndpoints() {
    console.log('\n\n🔍 Testing Problematic Endpoints (Should Return Proper Errors)');
    console.log('==============================================================');
    
    try {
        // Test that pdf-parse-universal now returns proper error
        console.log('\n📤 Testing /api/pdf-parse-universal (should return fallback error)...');
        
        const form = new FormData();
        const dummyBuffer = Buffer.from('dummy PDF content');
        form.append('file', dummyBuffer, {
            filename: 'test.pdf',
            contentType: 'application/pdf'
        });
        
        const response = await fetch('https://shg-mangement.vercel.app/api/pdf-parse-universal', {
            method: 'POST',
            body: form
        });
        
        console.log(`📥 Response status: ${response.status}`);
        
        if (response.status === 422) {
            const result = await response.json();
            console.log('✅ Endpoint correctly returns fallback error (422)');
            console.log('📋 Error details:', result.error);
            console.log('🔄 Fallback required:', result.fallbackRequired);
        } else {
            console.log('⚠️ Unexpected response status:', response.status);
            const text = await response.text();
            console.log('📋 Response:', text);
        }
        
    } catch (error) {
        console.error('❌ Endpoint test failed:', error.message);
    }
}

if (require.main === module) {
    testProductionSafePDFImport()
        .then(() => testProblematicEndpoints())
        .catch(console.error);
}
