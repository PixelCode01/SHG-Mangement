#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');

async function testUniversalParser() {
    try {
        const fetch = (await import('node-fetch')).default;
        
        console.log('\n=== Testing Universal PDF Parser ===\n');
        
        const testFile = '/home/pixel/Downloads/SWAWLAMBAN till may 2025.pdf';
        
        if (!fs.existsSync(testFile)) {
            console.log('❌ Test file not found:', testFile);
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
        
        console.log('\n🚀 Uploading to Universal Parser API...');
        
        const response = await fetch('http://localhost:3000/api/pdf-parse-universal', {
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
        console.log('  - Header found:', result.headerFound);
        console.log('  - Pattern detected:', result.patternDetected);
        console.log('  - Column positions:', result.columnPositions);
        
        // Check if we have the members array
        if (result.members && Array.isArray(result.members)) {
            console.log('  - Members array found:', result.members.length, 'members');
            console.log('\n👥 First 5 parsed members:');
            result.members.slice(0, 5).forEach((member, i) => {
                const loan = member['loan amount'] || '0';
                const email = member.email || 'No email';
                const phone = member.phone || 'No phone';
                console.log(`  ${i + 1}. ${member.name} - Loan: ₹${parseInt(loan).toLocaleString()} | Email: ${email} | Phone: ${phone}`);
            });
            
            if (result.members.length > 5) {
                console.log(`  ... and ${result.members.length - 5} more members`);
            }
        } else {
            console.log('  - No members array found');
        }
        
        if (result.statistics) {
            console.log('\n📊 Statistics from API:');
            console.log('  - Total members:', result.statistics.totalMembers);
            console.log('  - Members with loans:', result.statistics.membersWithLoans);
            console.log('  - Members without loans:', result.statistics.membersWithoutLoans);
            console.log('  - Total loan amount: ₹' + (result.statistics.totalLoanAmount || 0).toLocaleString());
        }
        
        // Test the component processing
        console.log('\n🔧 Testing Component Processing...');
        
        let processedMembers = [];
        
        if (result.members && Array.isArray(result.members)) {
            processedMembers = result.members.map((member) => ({
                name: member.name || '',
                loanAmount: parseInt(member['loan amount'] || '0'),
                email: member.email || '',
                phone: member.phone || '',
                memberNumber: '',
                accountNumber: '',
                personalContribution: 0,
                monthlyContribution: 0,
                joinedAt: new Date(),
            }));
        }
        
        console.log('✅ Component processing complete');
        console.log('  - Members processed:', processedMembers.length);
        
        const membersWithLoans = processedMembers.filter(m => m.loanAmount > 0);
        const membersWithoutLoans = processedMembers.filter(m => m.loanAmount === 0);
        const totalLoanAmount = processedMembers.reduce((sum, m) => sum + m.loanAmount, 0);
        
        console.log('\n📊 Final Component Results:');
        console.log(`  - Total members: ${processedMembers.length}`);
        console.log(`  - Members with loans: ${membersWithLoans.length}`);
        console.log(`  - Members without loans: ${membersWithoutLoans.length}`);
        console.log(`  - Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
        
        // Sample data
        console.log('\n📋 Sample Processed Members:');
        processedMembers.slice(0, 5).forEach((member, i) => {
            const loanStr = member.loanAmount > 0 ? `₹${member.loanAmount.toLocaleString()}` : 'No loan';
            console.log(`  ${i + 1}. ${member.name} - ${loanStr}`);
        });
        
        const expectedTotal = 51;
        const expectedWithLoans = 31;
        const expectedLoanAmount = 6993284;
        
        console.log('\n🎯 Validation:');
        console.log(`  Total members: ${processedMembers.length === expectedTotal ? '✅' : '❌'} (Expected: ${expectedTotal}, Got: ${processedMembers.length})`);
        console.log(`  Members with loans: ${membersWithLoans.length === expectedWithLoans ? '✅' : '❌'} (Expected: ${expectedWithLoans}, Got: ${membersWithLoans.length})`);
        console.log(`  Total loan amount: ${totalLoanAmount === expectedLoanAmount ? '✅' : '❌'} (Expected: ₹${expectedLoanAmount.toLocaleString()}, Got: ₹${totalLoanAmount.toLocaleString()})`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testUniversalParser();
