#!/usr/bin/env node

async function testPeriodicRecordAPI() {
  try {
    const fetch = (await import('node-fetch')).default;
    
    console.log('🧪 Testing Periodic Record API for loan amounts...\n');

    const groupId = '68383f548c036a65601e52bb';
    const recordId = '68383f578c036a65601e52c1';
    const apiUrl = `http://localhost:3000/api/groups/${groupId}/periodic-records/${recordId}`;

    console.log(`📞 Calling API: ${apiUrl}`);

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    
    console.log('✅ API Response received successfully\n');
    
    console.log('=== Periodic Record Data ===');
    console.log(`Record ID: ${data.id}`);
    console.log(`Group ID: ${data.groupId}`);
    console.log(`Meeting Date: ${data.meetingDate}`);
    console.log(`Total Members: ${data.memberRecords?.length || 0}\n`);

    if (data.memberRecords && data.memberRecords.length > 0) {
      console.log('=== Member Loan Amounts ===');
      
      for (const memberRecord of data.memberRecords) {
        const memberName = memberRecord.memberName || memberRecord.memberId;
        const loanAmount = memberRecord.memberCurrentLoanBalance || 0;
        
        console.log(`👤 ${memberName}:`);
        console.log(`   💰 Loan Amount: ₹${loanAmount.toLocaleString('en-IN')}`);
        console.log(`   📊 Contribution: ₹${memberRecord.compulsoryContribution || 0}`);
        console.log(`   🏦 Loan Repayment: ₹${memberRecord.loanRepaymentPrincipal || 0}`);
        console.log('');
      }

      // Summary
      const totalLoanAmount = data.memberRecords.reduce((sum, record) => 
        sum + (record.memberCurrentLoanBalance || 0), 0);
      const membersWithLoans = data.memberRecords.filter(record => 
        (record.memberCurrentLoanBalance || 0) > 0).length;
      
      console.log('=== Summary ===');
      console.log(`Total Loan Amount: ₹${totalLoanAmount.toLocaleString('en-IN')}`);
      console.log(`Members with Loans: ${membersWithLoans}/${data.memberRecords.length}`);
      console.log(`Average Loan Amount: ₹${Math.round(totalLoanAmount / data.memberRecords.length).toLocaleString('en-IN')}`);

      // Check if all amounts are non-zero
      const allNonZero = data.memberRecords.every(record => 
        (record.memberCurrentLoanBalance || 0) > 0);
      
      if (allNonZero) {
        console.log('\n✅ SUCCESS: All members have non-zero loan amounts!');
      } else {
        console.log('\n⚠️  WARNING: Some members have zero loan amounts');
      }
    } else {
      console.log('❌ No member records found in the response');
    }

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

// Check if the development server is running
async function checkServerAndTest() {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const healthCheck = await fetch('http://localhost:3000');
    if (healthCheck.ok) {
      await testPeriodicRecordAPI();
    } else {
      console.log('❌ Development server not responding');
      console.log('💡 Please start the server with: npm run dev');
    }
  } catch (error) {
    console.log('❌ Development server not running');
    console.log('💡 Please start the server with: npm run dev');
  }
}

checkServerAndTest();
