// Test to check loan data in the database
console.log('=== LOAN BALANCE DEBUG TEST ===');

async function debugLoanBalances() {
  try {
    // Test the groups API to see what loan data we're getting
    const response = await fetch('/api/groups');
    console.log('Groups API status:', response.status);
    
    if (response.ok) {
      const groups = await response.json();
      console.log('Available groups:', groups.length);
      
      if (groups.length > 0) {
        const firstGroup = groups[0];
        console.log('Testing group:', firstGroup.name, firstGroup.id);
        
        // Get detailed group info
        const groupResponse = await fetch(`/api/groups/${firstGroup.id}`);
        console.log('Group detail response status:', groupResponse.status);
        
        if (groupResponse.ok) {
          const groupData = await groupResponse.json();
          console.log('Group members count:', groupData.members.length);
          
          groupData.members.forEach((member, index) => {
            console.log(`Member ${index + 1}:`, {
              name: member.name,
              id: member.id,
              currentLoanAmount: member.currentLoanAmount,
              currentLoanBalance: member.currentLoanBalance,
              currentShareAmount: member.currentShareAmount
            });
          });
          
          // Also check the loans API directly
          console.log('\n=== DIRECT LOANS API TEST ===');
          const loansResponse = await fetch(`/api/groups/${firstGroup.id}/loans`);
          console.log('Loans API status:', loansResponse.status);
          
          if (loansResponse.ok) {
            const loansData = await loansResponse.json();
            console.log('Loans count:', loansData.length);
            console.log('Loans data:', loansData);
          } else {
            const errorText = await loansResponse.text();
            console.error('Loans API error:', errorText);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in debug test:', error);
  }
}

debugLoanBalances();
