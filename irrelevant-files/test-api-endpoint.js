#!/usr/bin/env node

async function testAPIEndpoint() {
  const fetch = (await import('node-fetch')).default;
  try {
    console.log('🔍 TESTING API ENDPOINT DIRECTLY\n');

    const groupId = '68382afd6cad8afd7cf5bb1f';
    const recordId = '683833114b84cdb1253376b2';
    
    const url = `http://localhost:3000/api/groups/${groupId}/periodic-records/${recordId}`;
    console.log(`📡 Testing URL: ${url}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ API Response: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error details:', errorText);
      return;
    }

    const data = await response.json();
    console.log(`✅ API Response: ${response.status} ${response.statusText}`);
    
    console.log('\n=== API RESPONSE STRUCTURE ===');
    console.log(`Member Records: ${data.memberRecords?.length || 0}`);
    
    if (data.memberRecords && data.memberRecords.length > 0) {
      console.log('\n👥 Member Records in API Response:');
      
      data.memberRecords.forEach((mr, index) => {
        console.log(`\n   ${index + 1}. Member:`);
        console.log(`      memberId: ${mr.memberId}`);
        console.log(`      memberName: ${mr.memberName || 'N/A'}`);
        console.log(`      memberCurrentLoanBalance: ${mr.memberCurrentLoanBalance || 'MISSING'}`);
        console.log(`      compulsoryContribution: ${mr.compulsoryContribution}`);
        
        // Check if member data is included
        if (mr.member) {
          console.log(`      member.name: ${mr.member.name}`);
          console.log(`      member.initialLoanAmount: ${mr.member.initialLoanAmount || 0}`);
          console.log(`      member.loans: ${mr.member.loans?.length || 0} loans`);
          
          if (mr.member.loans && mr.member.loans.length > 0) {
            mr.member.loans.forEach((loan, loanIndex) => {
              console.log(`        Loan ${loanIndex + 1}: ₹${loan.currentBalance}`);
            });
          }
        } else {
          console.log(`      member: NO MEMBER DATA`);
        }
      });
      
      // Check what the frontend calculation should produce
      console.log('\n🧮 Frontend Should Calculate:');
      data.memberRecords.forEach((mr, index) => {
        if (mr.member && mr.member.loans) {
          const calculatedBalance = mr.member.loans.reduce((total, loan) => {
            const balance = typeof loan.currentBalance === 'number' ? loan.currentBalance : parseFloat(loan.currentBalance) || 0;
            return total + balance;
          }, 0);
          
          console.log(`   ${mr.member.name}: ₹${calculatedBalance}`);
        }
      });
    } else {
      console.log('❌ No member records in API response');
    }

  } catch (error) {
    console.error('❌ Error testing API:', error);
    console.error('Error message:', error.message);
  }
}

testAPIEndpoint();
