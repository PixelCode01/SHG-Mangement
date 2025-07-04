import fetch from 'node-fetch';

async function debugLoanData() {
  try {
    console.log('Fetching periodic record data...');
    const response = await fetch('http://localhost:3000/api/groups/68381a2c05cb588247af871e/periodic-records/68381a3405cb588247af8752');
    
    if (!response.ok) {
      console.error('API Response not OK:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('Full API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n=== MEMBER RECORDS ANALYSIS ===');
    if (data.memberRecords) {
      data.memberRecords.forEach((mr, index) => {
        console.log(`\nMember ${index + 1}:`);
        console.log(`  ID: ${mr.memberId}`);
        console.log(`  Name: ${mr.member?.name || 'N/A'}`);
        console.log(`  Initial Loan Amount: ${mr.member?.initialLoanAmount || 'N/A'}`);
        console.log(`  Active Loans:`, mr.member?.loans || []);
        
        if (mr.member?.loans && mr.member.loans.length > 0) {
          const totalCurrentBalance = mr.member.loans.reduce((total, loan) => total + loan.currentBalance, 0);
          console.log(`  Total Current Loan Balance: ${totalCurrentBalance}`);
        } else {
          console.log(`  Total Current Loan Balance: 0 (no active loans)`);
        }
      });
    } else {
      console.log('No member records found');
    }
    
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

debugLoanData();
