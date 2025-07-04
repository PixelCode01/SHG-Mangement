#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');

async function testAPIEndpoint() {
    const fetch = (await import('node-fetch')).default;
    
    try {
        console.log('🧪 Testing API Endpoint...\n');
        
        const pdfPath = '/home/pixel/Downloads/Swawlamban_Loan_Info.pdf';
        
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ PDF file not found:', pdfPath);
            return;
        }
        
        // Test the universal parser endpoint
        console.log('📄 Testing Universal PDF Parser API...');
        const form = new FormData();
        form.append('file', fs.createReadStream(pdfPath), {
            filename: 'Swawlamban_Loan_Info.pdf',
            contentType: 'application/pdf'
        });
        
        const response = await fetch('http://localhost:3003/api/pdf-parse-universal', {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API request failed:', response.status, errorText);
            return;
        }
        
        const result = await response.json();
        
        if (result.success && result.members) {
            console.log('✅ API call successful!');
            console.log(`📊 Found ${result.members.length} members`);
            
            // Show first few members with loan amounts
            console.log('\n👥 Sample members from API:');
            result.members.slice(0, 5).forEach((member, index) => {
                console.log(`${index + 1}. ${member.name} - Loan: ₹${member.loanAmount || 0} (String: "${member['loan amount'] || '0'}")`);
            });
            
            // Count members with non-zero loans
            const membersWithLoans = result.members.filter(m => (m.loanAmount || 0) > 0);
            console.log(`\n💰 Members with loans: ${membersWithLoans.length}/${result.members.length}`);
            
            if (membersWithLoans.length > 0) {
                console.log('✅ API is correctly parsing loan amounts!');
                console.log('\n💳 Members with highest loans:');
                membersWithLoans
                    .sort((a, b) => (b.loanAmount || 0) - (a.loanAmount || 0))
                    .slice(0, 3)
                    .forEach((member, index) => {
                        console.log(`${index + 1}. ${member.name} - ₹${member.loanAmount} (${typeof member.loanAmount})`);
                    });
                
                // Check if both loanAmount and 'loan amount' properties exist
                const sampleMember = membersWithLoans[0];
                console.log('\n🔍 Sample member structure:');
                console.log('- loanAmount (number):', sampleMember.loanAmount, typeof sampleMember.loanAmount);
                console.log('- "loan amount" (string):', sampleMember['loan amount'], typeof sampleMember['loan amount']);
                
                if (sampleMember.loanAmount && sampleMember['loan amount']) {
                    console.log('✅ Both loanAmount and "loan amount" properties exist - this should fix the MultiStepGroupForm bug!');
                } else {
                    console.log('⚠️  Missing property structure that might cause issues in MultiStepGroupForm');
                }
            } else {
                console.log('❌ No loan amounts parsed via API - there might still be an issue');
            }
        } else {
            console.log('❌ API parsing failed:', result);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAPIEndpoint();
