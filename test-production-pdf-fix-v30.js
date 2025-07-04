#!/usr/bin/env node

// Test Production PDF Fix V30 - Verify robust error handling and fallback strategies
// This script tests both the main PDF extraction and PDF-to-Excel conversion endpoints

console.log('🚀 Testing Production PDF Fix V30 - Robust Error Handling');
console.log('=' .repeat(80));

const fs = require('fs');
const path = require('path');

async function testProductionPDFEndpoints() {
    const testFile = '/home/pixel/Downloads/members.pdf';
    
    if (!fs.existsSync(testFile)) {
        console.log('❌ Test PDF file not found:', testFile);
        console.log('📝 Please ensure the test PDF file exists');
        return;
    }

    console.log('📁 Test file found:', testFile);
    console.log('📊 File size:', fs.statSync(testFile).size, 'bytes');
    console.log('');

    // Test 1: Main PDF extraction endpoint
    console.log('🔍 TEST 1: Main PDF Extraction Endpoint (/api/pdf-upload-v15)');
    console.log('-' .repeat(60));
    
    try {
        console.log('📤 Sending request to /api/pdf-upload-v15...');
        
        const FormData = require('form-data');
        const fetch = require('node-fetch');
        
        const form = new FormData();
        form.append('file', fs.createReadStream(testFile), 'members.pdf');
        
        const response = await fetch('http://localhost:3000/api/pdf-upload-v15', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        console.log('📡 Response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ SUCCESS - PDF extraction successful!');
            console.log('📊 Result summary:');
            console.log('   - Success:', result.success);
            console.log('   - Members extracted:', result.totalExtracted || result.members?.length || 0);
            console.log('   - Extraction method:', result.extractionMethod || 'unknown');
            console.log('   - Text length:', result.textLength || 'unknown');
            
            if (result.members && result.members.length > 0) {
                console.log('👥 First 5 extracted members:');
                result.members.slice(0, 5).forEach((member, index) => {
                    console.log(`   ${index + 1}. ${member.name} (confidence: ${member.confidence || 'N/A'}, source: ${member.source || 'N/A'})`);
                });
            }
        } else {
            const errorResult = await response.text();
            console.log('❌ FAILED - Response not OK');
            console.log('📄 Error response:', errorResult);
        }
        
    } catch (error) {
        console.log('❌ FAILED - Request error:', error.message);
    }
    
    console.log('');

    // Test 2: PDF-to-Excel conversion endpoint
    console.log('🔍 TEST 2: PDF-to-Excel Conversion Endpoint (/api/pdf-to-excel)');
    console.log('-' .repeat(60));
    
    try {
        console.log('📤 Sending request to /api/pdf-to-excel...');
        
        const FormData = require('form-data');
        const fetch = require('node-fetch');
        
        const form = new FormData();
        form.append('file', fs.createReadStream(testFile), 'members.pdf');
        
        const response = await fetch('http://localhost:3000/api/pdf-to-excel', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        console.log('📡 Response status:', response.status);
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log('📄 Content type:', contentType);
            
            if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
                console.log('✅ SUCCESS - PDF-to-Excel conversion successful!');
                console.log('📊 Excel file generated successfully');
                
                // Optionally save the Excel file
                const buffer = await response.buffer();
                const outputPath = '/tmp/test-pdf-to-excel-v30.xlsx';
                fs.writeFileSync(outputPath, buffer);
                console.log('💾 Excel file saved to:', outputPath);
                console.log('📏 Excel file size:', buffer.length, 'bytes');
                
            } else {
                const result = await response.text();
                console.log('⚠️ Unexpected content type, response:', result);
            }
        } else {
            const errorResult = await response.text();
            console.log('❌ FAILED - Response not OK');
            console.log('📄 Error response:', errorResult);
        }
        
    } catch (error) {
        console.log('❌ FAILED - Request error:', error.message);
    }
    
    console.log('');

    // Test 3: Check endpoint status
    console.log('🔍 TEST 3: Endpoint Status Check');
    console.log('-' .repeat(60));
    
    try {
        const fetch = require('node-fetch');
        
        const response1 = await fetch('http://localhost:3000/api/pdf-upload-v15');
        const status1 = await response1.json();
        console.log('📊 /api/pdf-upload-v15 status:', status1);
        
        const response2 = await fetch('http://localhost:3000/api/pdf-to-excel');
        const status2 = await response2.json();
        console.log('📊 /api/pdf-to-excel status:', status2);
        
    } catch (error) {
        console.log('❌ Status check failed:', error.message);
    }
    
    console.log('');
    console.log('🏁 Production PDF Fix V30 Testing Complete!');
    console.log('=' .repeat(80));
}

// Check if server is running
async function checkServer() {
    try {
        const fetch = require('node-fetch');
        const response = await fetch('http://localhost:3000/api/pdf-upload-v15');
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function main() {
    console.log('🔍 Checking if development server is running...');
    
    const serverRunning = await checkServer();
    
    if (!serverRunning) {
        console.log('❌ Development server is not running or not accessible');
        console.log('📝 Please start the server with: npm run dev');
        console.log('');
        return;
    }
    
    console.log('✅ Development server is running');
    console.log('');
    
    await testProductionPDFEndpoints();
}

if (require.main === module) {
    main().catch(console.error);
}
