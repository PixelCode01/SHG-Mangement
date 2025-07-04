#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');

async function debugComponentProcessing() {
    try {
        const fetch = (await import('node-fetch')).default;
        
        console.log('\n=== Debug Component Processing ===\n');
        
        // Step 1: Get the API response exactly as the component would
        const testFile = '/home/pixel/Downloads/SWAWLAMBAN till may 2025.pdf';
        
        if (!fs.existsSync(testFile)) {
            console.log('❌ Test file not found:', testFile);
            return;
        }
        
        const form = new FormData();
        form.append('file', fs.createReadStream(testFile), {
            filename: 'SWAWLAMBAN till may 2025.pdf',
            contentType: 'application/pdf'
        });
        
        const response = await fetch('http://localhost:3000/api/pdf-parse-swawlamban', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        if (!response.ok) {
            console.log('❌ API failed:', response.status, response.statusText);
            return;
        }
        
        const data = await response.json();
        console.log('📡 Raw API Response Structure:');
        console.log('  - success:', data.success);
        console.log('  - members type:', typeof data.members);
        console.log('  - members isArray:', Array.isArray(data.members));
        console.log('  - members length:', data.members?.length);
        
        if (data.members && data.members.length > 0) {
            console.log('\n🔍 First Member Raw Data:');
            const firstMember = data.members[0];
            console.log('  - Raw member object:', JSON.stringify(firstMember, null, 2));
            console.log('  - member.name:', firstMember.name);
            console.log('  - member["loan amount"]:', firstMember['loan amount']);
            console.log('  - typeof loan amount:', typeof firstMember['loan amount']);
        }
        
        // Step 2: Simulate the exact component processing
        console.log('\n🔧 Simulating Component Processing:');
        
        const apiEndpoint = '/api/pdf-parse-swawlamban';
        
        if (apiEndpoint === '/api/pdf-parse-swawlamban' && data.members && Array.isArray(data.members)) {
            console.log('✅ Condition met - using pre-parsed SWAWLAMBAN members');
            
            const processedMembers = data.members.map((member, index) => {
                const name = member.name || '';
                const rawLoanAmount = member['loan amount'];
                const parsedLoanAmount = parseInt(rawLoanAmount || '0');
                
                if (index < 5) {  // Debug first 5 members
                    console.log(`  Member ${index + 1}: "${name}"`);
                    console.log(`    - Raw loan amount: "${rawLoanAmount}" (type: ${typeof rawLoanAmount})`);
                    console.log(`    - Parsed loan amount: ${parsedLoanAmount}`);
                }
                
                return {
                    name: name,
                    loanAmount: parsedLoanAmount,
                    memberNumber: '',
                    accountNumber: '',
                    personalContribution: 0,
                    monthlyContribution: 0,
                    joinedAt: new Date(),
                };
            });
            
            console.log(`\n📊 Processing Results:`);
            console.log(`  - Total processed: ${processedMembers.length}`);
            
            const membersWithLoans = processedMembers.filter(m => m.loanAmount > 0);
            const totalLoanAmount = processedMembers.reduce((sum, m) => sum + m.loanAmount, 0);
            
            console.log(`  - Members with loans: ${membersWithLoans.length}`);
            console.log(`  - Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
            
            console.log('\n👥 First 5 Processed Members:');
            processedMembers.slice(0, 5).forEach((member, i) => {
                const loanStr = member.loanAmount > 0 ? `₹${member.loanAmount.toLocaleString()}` : 'No loan';
                console.log(`  ${i + 1}. ${member.name} - ${loanStr}`);
            });
            
            // Check if any loan amounts are actually 0 when they shouldn't be
            const shouldHaveLoans = ['SANTOSH MISHRA', 'ANUP KUMAR KESHRI', 'MANOJ MISHRA'];
            console.log('\n🔍 Specific Member Check:');
            shouldHaveLoans.forEach(name => {
                const member = processedMembers.find(m => m.name === name);
                if (member) {
                    console.log(`  - ${name}: ₹${member.loanAmount.toLocaleString()}`);
                } else {
                    console.log(`  - ${name}: NOT FOUND`);
                }
            });
            
        } else {
            console.log('❌ Condition not met for SWAWLAMBAN processing');
            console.log('  - apiEndpoint:', apiEndpoint);
            console.log('  - data.members exists:', !!data.members);
            console.log('  - data.members isArray:', Array.isArray(data.members));
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugComponentProcessing();
