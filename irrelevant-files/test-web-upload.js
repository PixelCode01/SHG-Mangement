#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');

async function testWebUpload() {
    try {
        const fetch = (await import('node-fetch')).default;
        
        console.log('\n=== Testing SWAWLAMBAN Web Upload ===\n');
        
        // Check if the server is running
        const healthCheck = await fetch('http://localhost:3000/api/pdf-parse-swawlamban', {
            method: 'OPTIONS'
        }).catch(() => null);
        
        if (!healthCheck) {
            console.log('❌ Development server not running. Please start it with: npm run dev');
            return;
        }
        
        // Test file path
        const testFile = '/home/pixel/Downloads/SWAWLAMBAN till may 2025.pdf';
        
        if (!fs.existsSync(testFile)) {
            console.log('❌ Test file not found:', testFile);
            console.log('Please ensure the SWAWLAMBAN PDF file is in the Downloads folder');
            return;
        }
        
        console.log('✅ Found test file:', testFile);
        console.log('📁 File size:', (fs.statSync(testFile).size / 1024).toFixed(2), 'KB');
        
        // Create form data
        const form = new FormData();
        form.append('file', fs.createReadStream(testFile), {
            filename: 'SWAWLAMBAN till may 2025.pdf',
            contentType: 'application/pdf'
        });
        
        console.log('\n🚀 Uploading to SWAWLAMBAN API...');
        
        const response = await fetch('http://localhost:3000/api/pdf-parse-swawlamban', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        console.log('📊 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Error response:', errorText);
            return;
        }
        
        const result = await response.json();
        console.log('\n✅ Upload successful!');
        console.log('📈 Results:');
        console.log('  - Success:', result.success);
        console.log('  - Total members found:', result.totalMembers || 'Not specified');
        console.log('  - Members with loans:', result.membersWithLoans || 'Not specified');
        console.log('  - Members without loans:', result.membersWithoutLoans || 'Not specified');
        console.log('  - Total loan amount:', result.totalLoanAmount || 'Not specified');
        
        // Check if we have the members array
        if (result.members && Array.isArray(result.members)) {
            console.log('  - Members array found:', result.members.length, 'members');
            console.log('\n👥 First 5 parsed members:');
            result.members.slice(0, 5).forEach((member, i) => {
                console.log(`  ${i + 1}. ${member.name} - Loan: ₹${member['loan amount'] || 0}`);
            });
            
            if (result.members.length > 5) {
                console.log(`  ... and ${result.members.length - 5} more members`);
            }
        } else {
            console.log('  - No members array found');
        }
        
        if (result.pages) {
            console.log('  - Pages extracted:', result.pages.length);
            console.log('  - Sample text (first 200 chars):', result.pages.join(' ').substring(0, 200) + '...');
        }
        
        if (result.statistics) {
            console.log('\n📊 Statistics from API:');
            console.log('  - Total members:', result.statistics.totalMembers);
            console.log('  - Members with loans:', result.statistics.membersWithLoans);
            console.log('  - Members without loans:', result.statistics.membersWithoutLoans);
            console.log('  - Total loan amount: ₹' + (result.statistics.totalLoanAmount || 0).toLocaleString());
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
testWebUpload();
