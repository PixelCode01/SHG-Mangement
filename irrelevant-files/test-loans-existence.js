// Simple test script to check if we have loans in the database
const groupId = '684bae097517c05bab9a2eac'; // Replace with actual group ID

async function checkLoansInDatabase() {
  console.log('🔍 Checking loans in database for group:', groupId);
  
  try {
    // Test the loans API directly
    const response = await fetch(`/api/groups/${groupId}/loans`);
    console.log('Loans API response status:', response.status);
    
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    if (response.ok) {
      const loans = JSON.parse(responseText);
      console.log('Loans found:', loans.length);
      console.log('Loan details:', loans);
      
      if (loans.length === 0) {
        console.log('❌ No loans found in database');
      } else {
        loans.forEach((loan, index) => {
          console.log(`Loan ${index + 1}:`, {
            id: loan.id,
            memberId: loan.memberId,
            memberName: loan.member?.name,
            originalAmount: loan.originalAmount,
            currentBalance: loan.currentBalance,
            status: loan.status,
            loanType: loan.loanType
          });
        });
      }
    } else {
      console.error('❌ Error fetching loans:', responseText);
    }
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

checkLoansInDatabase();
