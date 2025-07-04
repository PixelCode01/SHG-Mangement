#!/usr/bin/env node

// Test Client-Side PDF Import with Production V30 Fixes
// This simulates the client-side PDF import process with automatic fallback

console.log('🚀 Testing Client-Side PDF Import with V30 Production Fixes');
console.log('=' .repeat(80));

const fs = require('fs');

async function testClientSidePDFImport() {
    const testFile = '/home/pixel/Downloads/members.pdf';
    
    if (!fs.existsSync(testFile)) {
        console.log('❌ Test PDF file not found:', testFile);
        return;
    }

    console.log('📁 Test file found:', testFile);
    console.log('🔄 Simulating client-side PDF import process...');
    console.log('');

    // Test the exact flow the client uses
    try {
        const FormData = require('form-data');
        const fetch = require('node-fetch');
        
        console.log('📤 Step 1: Attempting primary PDF extraction via /api/pdf-upload-v15');
        
        const form = new FormData();
        form.append('file', fs.createReadStream(testFile), 'members.pdf');
        
        const response = await fetch('http://localhost:3000/api/pdf-upload-v15', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        console.log('📡 Primary extraction response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.members && result.members.length > 0) {
                console.log('✅ SUCCESS - Primary extraction successful!');
                console.log('📊 Extraction summary:');
                console.log(`   - Members extracted: ${result.members.length}`);
                console.log(`   - Extraction method: ${result.extractionMethod}`);
                console.log(`   - Text length: ${result.textLength}`);
                
                console.log('');
                console.log('👥 Extracted members (first 10):');
                result.members.slice(0, 10).forEach((member, index) => {
                    console.log(`   ${index + 1}. ${member.name}`);
                });
                
                console.log('');
                console.log('🎯 Client-side processing would succeed with these members');
                console.log('   - Members would be displayed in the UI');
                console.log('   - User could review and confirm');
                console.log('   - No fallback needed');
                
            } else {
                console.log('⚠️ Primary extraction returned no members');
                console.log('🔄 Client would trigger automatic fallback...');
                await testFallbackScenario();
            }
        } else {
            console.log('❌ Primary extraction failed');
            console.log('🔄 Client would trigger automatic fallback...');
            await testFallbackScenario();
        }
        
    } catch (error) {
        console.log('❌ Primary extraction error:', error.message);
        console.log('🔄 Client would trigger automatic fallback...');
        await testFallbackScenario();
    }
    
    console.log('');
    console.log('🏁 Client-Side PDF Import Testing Complete!');
}

async function testFallbackScenario() {
    console.log('');
    console.log('🔄 Testing Automatic Fallback Scenario');
    console.log('-' .repeat(50));
    
    try {
        const FormData = require('form-data');
        const fetch = require('node-fetch');
        
        console.log('📤 Step 2: Automatic fallback to PDF-to-Excel conversion');
        
        const testFile = '/home/pixel/Downloads/members.pdf';
        const form = new FormData();
        form.append('file', fs.createReadStream(testFile), 'members.pdf');
        
        const response = await fetch('http://localhost:3000/api/pdf-to-excel', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        console.log('📡 Fallback conversion response status:', response.status);
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
                console.log('✅ SUCCESS - Fallback conversion successful!');
                console.log('📊 Excel file generated for download');
                console.log('🎯 Client-side fallback behavior:');
                console.log('   - Excel file automatically downloaded');
                console.log('   - User instructed to import Excel file instead');
                console.log('   - Transparent fallback operation (no manual conversion)');
                
                const buffer = await response.buffer();
                const outputPath = '/tmp/client-test-fallback-v30.xlsx';
                fs.writeFileSync(outputPath, buffer);
                console.log(`💾 Fallback Excel saved to: ${outputPath}`);
                
            } else {
                console.log('❌ Fallback conversion failed - unexpected content type');
            }
        } else {
            console.log('❌ Fallback conversion failed - HTTP error');
        }
        
    } catch (error) {
        console.log('❌ Fallback conversion error:', error.message);
    }
}

async function main() {
    // Check if server is running
    try {
        const fetch = require('node-fetch');
        const response = await fetch('http://localhost:3000/api/pdf-upload-v15');
        
        if (!response.ok) {
            console.log('❌ Development server is not accessible');
            console.log('📝 Please ensure the server is running with: npm run dev');
            return;
        }
    } catch (error) {
        console.log('❌ Development server is not running');
        console.log('📝 Please start the server with: npm run dev');
        return;
    }
    
    console.log('✅ Development server is accessible');
    console.log('');
    
    await testClientSidePDFImport();
}

if (require.main === module) {
    main().catch(console.error);
}
