// Test the authenticated API endpoint
async function testAuthenticatedAPI() {
  console.log('🔍 Testing authenticated API access...');
  
  try {
    // This will run in the browser context where authentication cookies are available
    const response = await fetch('/api/groups/68381a2c05cb588247af871e/periodic-records/68381a3405cb588247af8752');
    
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    console.log('✅ API Response received');
    
    console.log('\n📊 Periodic Record Data:');
    console.log(`  ID: ${data.id}`);
    console.log(`  Meeting Date: ${data.meetingDate}`);
    console.log(`  Member Records: ${data.memberRecords?.length || 0}`);
    
    if (data.memberRecords && data.memberRecords.length > 0) {
      console.log('\n👥 Member Records:');
      data.memberRecords.forEach((mr, index) => {
        console.log(`  ${index + 1}. Member ID: ${mr.memberId}`);
        console.log(`     Member Name: ${mr.member?.name || 'Unknown'}`);
        console.log(`     Initial Loan Amount: ${mr.member?.initialLoanAmount || 0}`);
        console.log(`     Active Loans: ${mr.member?.loans?.length || 0}`);
        
        if (mr.member?.loans && mr.member.loans.length > 0) {
          mr.member.loans.forEach((loan, loanIndex) => {
            console.log(`       Loan ${loanIndex + 1}: ₹${loan.currentBalance} (Status: ${loan.status})`);
          });
          
          const totalCurrentBalance = mr.member.loans.reduce((total, loan) => total + loan.currentBalance, 0);
          console.log(`     Total Current Loan Balance: ₹${totalCurrentBalance}`);
        } else {
          console.log(`     Total Current Loan Balance: ₹0`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testAuthenticatedAPI();
