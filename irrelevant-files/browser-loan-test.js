// Simple test to check group data and try loan creation
console.log('=== LOAN CREATION TEST ===');

// First, let's check if we can reach the API
async function testLoanCreationFromBrowser() {
  try {
    // Test with a known group ID and member ID - you can change these based on your data
    const groupId = '6764dac97faa4d3ae1c8b71e'; // Example - replace with actual ID
    const memberId = '6764dac97faa4d3ae1c8b71f'; // Example - replace with actual ID
    
    console.log('Testing loan creation...');
    console.log('Group ID:', groupId);
    console.log('Member ID:', memberId);
    
    const loanData = {
      memberId: memberId,
      loanType: 'PERSONAL',
      originalAmount: 1000,
      interestRate: 12,
      dateIssued: new Date().toISOString(),
      status: 'ACTIVE'
    };
    
    console.log('Loan data:', loanData);
    
    const response = await fetch(`/api/groups/${groupId}/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loanData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    const responseText = await response.text();
    console.log('Response text:', responseText);
    
    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        console.error('Parsed error:', errorData);
      } catch (e) {
        console.error('Could not parse error response');
      }
    }
    
  } catch (error) {
    console.error('Network error:', error);
  }
}

// Also test getting groups and members
async function testGetGroupsAndMembers() {
  try {
    console.log('\n=== TESTING GROUPS API ===');
    const groupsResponse = await fetch('/api/groups');
    console.log('Groups response status:', groupsResponse.status);
    
    if (groupsResponse.ok) {
      const groups = await groupsResponse.json();
      console.log('Available groups:', groups.map(g => ({ id: g.id, name: g.name })));
      
      if (groups.length > 0) {
        const firstGroup = groups[0];
        console.log('\n=== TESTING GROUP DETAILS ===');
        console.log('Using group:', firstGroup.name, firstGroup.id);
        
        const groupDetailResponse = await fetch(`/api/groups/${firstGroup.id}`);
        console.log('Group detail response status:', groupDetailResponse.status);
        
        if (groupDetailResponse.ok) {
          const groupDetail = await groupDetailResponse.json();
          console.log('Group members:', groupDetail.members.map(m => ({ id: m.id, name: m.name })));
          
          if (groupDetail.members.length > 0) {
            const firstMember = groupDetail.members[0];
            console.log('\nTesting loan creation with real data...');
            
            const loanData = {
              memberId: firstMember.id,
              loanType: 'PERSONAL',
              originalAmount: 1000,
              interestRate: groupDetail.interestRate || 12,
              dateIssued: new Date().toISOString(),
              status: 'ACTIVE'
            };
            
            console.log('Real loan data:', loanData);
            
            const response = await fetch(`/api/groups/${firstGroup.id}/loans`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(loanData)
            });
            
            console.log('Real test response status:', response.status);
            const responseText = await response.text();
            console.log('Real test response:', responseText);
            
            if (!response.ok) {
              try {
                const errorData = JSON.parse(responseText);
                console.error('Real test parsed error:', errorData);
              } catch (e) {
                console.error('Could not parse real test error response');
              }
            } else {
              console.log('✅ Loan creation successful!');
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in group/member test:', error);
  }
}

// Run the tests
testGetGroupsAndMembers();
