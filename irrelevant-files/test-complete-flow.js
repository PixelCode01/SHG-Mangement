#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');

async function testCompleteFlow() {
    try {
        const fetch = (await import('node-fetch')).default;
        
        console.log('\n=== Complete SWAWLAMBAN Import Flow Test ===\n');
        
        // Step 1: Test the SWAWLAMBAN API directly
        console.log('🔍 Step 1: Testing SWAWLAMBAN API...');
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
        
        const apiResult = await response.json();
        console.log('✅ API Response received');
        console.log('  - Success:', apiResult.success);
        console.log('  - Members found:', apiResult.members?.length || 0);
        console.log('  - Statistics available:', !!apiResult.statistics);
        
        // Step 2: Simulate the component processing
        console.log('\n🔧 Step 2: Simulating component processing...');
        
        // This mimics what the MultiStepGroupForm component does
        let processedMembers = [];
        
        if (apiResult.members && Array.isArray(apiResult.members)) {
            console.log('✅ Using pre-parsed SWAWLAMBAN members');
            processedMembers = apiResult.members.map((member) => ({
                name: member.name || '',
                loanAmount: parseInt(member['loan amount'] || '0'),
                memberNumber: '', 
                accountNumber: '', 
                personalContribution: 0, 
                monthlyContribution: 0, 
                joinedAt: new Date(),
            }));
        } else {
            console.log('⚠️  Falling back to text processing');
            // Would process pages here...
        }
        
        console.log('✅ Component processing complete');
        console.log('  - Members processed:', processedMembers.length);
        
        // Step 3: Validate the results
        console.log('\n✅ Step 3: Validating results...');
        
        const membersWithLoans = processedMembers.filter(m => m.loanAmount > 0);
        const membersWithoutLoans = processedMembers.filter(m => m.loanAmount === 0);
        const totalLoanAmount = processedMembers.reduce((sum, m) => sum + m.loanAmount, 0);
        
        console.log('📊 Final Statistics:');
        console.log(`  - Total members: ${processedMembers.length}`);
        console.log(`  - Members with loans: ${membersWithLoans.length}`);
        console.log(`  - Members without loans: ${membersWithoutLoans.length}`);
        console.log(`  - Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
        
        // Step 4: Sample data validation
        console.log('\n📋 Sample Processed Members:');
        processedMembers.slice(0, 10).forEach((member, i) => {
            const loanStr = member.loanAmount > 0 ? `₹${member.loanAmount.toLocaleString()}` : 'No loan';
            console.log(`  ${i + 1}. ${member.name} - ${loanStr}`);
        });
        
        if (processedMembers.length > 10) {
            console.log(`  ... and ${processedMembers.length - 10} more members`);
        }
        
        // Expected values validation
        console.log('\n🎯 Validation:');
        const expectedTotal = 51;
        const expectedWithLoans = 31;
        const expectedWithoutLoans = 20;
        const expectedLoanAmount = 6993284;
        
        console.log(`  Total members: ${processedMembers.length === expectedTotal ? '✅' : '❌'} (Expected: ${expectedTotal}, Got: ${processedMembers.length})`);
        console.log(`  Members with loans: ${membersWithLoans.length === expectedWithLoans ? '✅' : '❌'} (Expected: ${expectedWithLoans}, Got: ${membersWithLoans.length})`);
        console.log(`  Members without loans: ${membersWithoutLoans.length === expectedWithoutLoans ? '✅' : '❌'} (Expected: ${expectedWithoutLoans}, Got: ${membersWithoutLoans.length})`);
        console.log(`  Total loan amount: ${totalLoanAmount === expectedLoanAmount ? '✅' : '❌'} (Expected: ₹${expectedLoanAmount.toLocaleString()}, Got: ₹${totalLoanAmount.toLocaleString()})`);
        
        const allCorrect = processedMembers.length === expectedTotal && 
                          membersWithLoans.length === expectedWithLoans && 
                          membersWithoutLoans.length === expectedWithoutLoans && 
                          totalLoanAmount === expectedLoanAmount;
        
        console.log(`\n${allCorrect ? '🎉' : '⚠️ '} Overall Result: ${allCorrect ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
        
        if (allCorrect) {
            console.log('\n✅ The web interface should now correctly import all 51 SWAWLAMBAN members with their loan amounts!');
        } else {
            console.log('\n❌ There are still issues with the import process that need to be addressed.');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testCompleteFlow();
