// Test to check all loans in database regardless of status
const groupId = '684bae097517c05bab9a2eac'; // Replace with your actual group ID

async function checkAllLoansInDatabase() {
  console.log('🔍 Checking ALL loans in database...');
  
  try {
    // Get the group data first to see what the API is returning
    const groupResponse = await fetch(`/api/groups/${groupId}`);
    console.log('Group API response status:', groupResponse.status);
    
    if (groupResponse.ok) {
      const groupData = await groupResponse.json();
      console.log('Group members with loan data:');
      groupData.members.forEach((member, index) => {
        console.log(`Member ${index + 1}: ${member.name}`, {
          currentLoanBalance: member.currentLoanBalance,
          currentLoanAmount: member.currentLoanAmount
        });
      });
    }

    // Also test the loans API endpoint directly (this shows ALL loans for the group)
    const loansResponse = await fetch(`/api/groups/${groupId}/loans`);
    console.log('\nLoans API response status:', loansResponse.status);
    
    if (loansResponse.ok) {
      const loansData = await loansResponse.json();
      console.log('Total loans found:', loansData.length);
      
      if (loansData.length > 0) {
        console.log('Loan details:');
        loansData.forEach((loan, index) => {
          console.log(`Loan ${index + 1}:`, {
            id: loan.id,
            memberId: loan.memberId,
            memberName: loan.member?.name,
            originalAmount: loan.originalAmount,
            currentBalance: loan.currentBalance,
            status: loan.status,
            loanType: loan.loanType,
            groupId: loan.groupId,
            dateIssued: loan.dateIssued
          });
        });
      } else {
        console.log('❌ No loans found via loans API');
      }
    } else {
      const errorText = await loansResponse.text();
      console.error('❌ Loans API error:', errorText);
    }

    // Check if there are loans with different statuses
    console.log('\n🔍 Checking for loans with any status...');
    // We can't directly query the database from frontend, but we can check server logs
    
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

checkAllLoansInDatabase();
