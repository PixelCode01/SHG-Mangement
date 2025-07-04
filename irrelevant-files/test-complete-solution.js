#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');

async function testPDFImport() {
    const fetch = (await import('node-fetch')).default;
    console.log('🧪 Testing Complete PDF Import Solution...\n');
    
    const pdfPath = '/home/pixel/Downloads/Swawlamban_Loan_Info.pdf';
    
    if (!fs.existsSync(pdfPath)) {
        console.error('❌ PDF file not found:', pdfPath);
        return;
    }
    
    try {
        // Test the universal parser endpoint
        console.log('📄 Testing Universal PDF Parser...');
        const form = new FormData();
        form.append('file', fs.createReadStream(pdfPath));
        
        const response = await fetch('http://localhost:3000/api/pdf-parse-universal', {
            method: 'POST',
            body: form
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        console.log('\n📊 Parse Results:');
        console.log(`✅ Success: ${result.success}`);
        console.log(`📈 Total Members: ${result.members ? result.members.length : 0}`);
        console.log(`🎯 Pattern Used: ${result.patternUsed || 'Unknown'}`);
        
        if (result.members && result.members.length > 0) {
            console.log('\n👥 Sample Members:');
            result.members.slice(0, 5).forEach((member, index) => {
                console.log(`${index + 1}. Name: "${member.name}" | Loan: ₹${member.loanAmount} | String: "${member['loan amount']}"`);
            });
            
            // Check for non-zero loan amounts
            const nonZeroLoans = result.members.filter(m => m.loanAmount > 0);
            console.log(`\n💰 Members with Non-Zero Loans: ${nonZeroLoans.length}/${result.members.length}`);
            
            if (nonZeroLoans.length > 0) {
                console.log('✅ SUCCESS: Loan amounts are being parsed correctly!');
                
                // Show loan amount distribution
                const amounts = nonZeroLoans.map(m => m.loanAmount).sort((a, b) => a - b);
                console.log(`📊 Loan Range: ₹${amounts[0]} - ₹${amounts[amounts.length - 1]}`);
            } else {
                console.log('❌ ISSUE: All loan amounts are still 0');
            }
            
            // Verify data structure consistency
            console.log('\n🔍 Data Structure Check:');
            const firstMember = result.members[0];
            console.log(`Has loanAmount property: ${firstMember.hasOwnProperty('loanAmount')}`);
            console.log(`Has 'loan amount' property: ${firstMember.hasOwnProperty('loan amount')}`);
            console.log(`loanAmount type: ${typeof firstMember.loanAmount}`);
            console.log(`'loan amount' type: ${typeof firstMember['loan amount']}`);
            
        } else {
            console.log('❌ No members parsed from PDF');
        }
        
        if (result.error) {
            console.log('\n⚠️ Error:', result.error);
        }
        
        if (result.debug) {
            console.log('\n🔧 Debug Info:', result.debug);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testPDFImport();
