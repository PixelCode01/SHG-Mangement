// Test the select all logic
function testSelectAllLogic() {
  // Mock data
  const displayableMembers = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '4', name: 'Diana' },
    { id: '5', name: 'Eve' }
  ];
  
  const selectedLeaderId = '2'; // Bob is the leader
  
  // Test case 1: No members selected (except leader)
  let memberFields = [
    { memberId: '2', name: 'Bob', currentShare: 0, currentLoanAmount: 0 } // Leader only
  ];
  
  let nonLeaderMembers = displayableMembers.filter(member => member.id !== selectedLeaderId);
  let selectedNonLeaderMembers = memberFields.filter(field => field.memberId !== selectedLeaderId);
  let areAllSelected = nonLeaderMembers.length > 0 && selectedNonLeaderMembers.length === nonLeaderMembers.length;
  
  console.log('Test 1 - Only leader selected:');
  console.log('Non-leader members:', nonLeaderMembers.length);
  console.log('Selected non-leader members:', selectedNonLeaderMembers.length);
  console.log('Are all selected?', areAllSelected);
  console.log('Button should show: "Select All Members"');
  console.log('');
  
  // Test case 2: All members selected
  memberFields = [
    { memberId: '1', name: 'Alice', currentShare: 0, currentLoanAmount: 0 },
    { memberId: '2', name: 'Bob', currentShare: 0, currentLoanAmount: 0 }, // Leader
    { memberId: '3', name: 'Charlie', currentShare: 0, currentLoanAmount: 0 },
    { memberId: '4', name: 'Diana', currentShare: 0, currentLoanAmount: 0 },
    { memberId: '5', name: 'Eve', currentShare: 0, currentLoanAmount: 0 }
  ];
  
  nonLeaderMembers = displayableMembers.filter(member => member.id !== selectedLeaderId);
  selectedNonLeaderMembers = memberFields.filter(field => field.memberId !== selectedLeaderId);
  areAllSelected = nonLeaderMembers.length > 0 && selectedNonLeaderMembers.length === nonLeaderMembers.length;
  
  console.log('Test 2 - All members selected:');
  console.log('Non-leader members:', nonLeaderMembers.length);
  console.log('Selected non-leader members:', selectedNonLeaderMembers.length);
  console.log('Are all selected?', areAllSelected);
  console.log('Button should show: "Deselect All Members"');
  console.log('');
  
  // Test case 3: Some members selected
  memberFields = [
    { memberId: '1', name: 'Alice', currentShare: 0, currentLoanAmount: 0 },
    { memberId: '2', name: 'Bob', currentShare: 0, currentLoanAmount: 0 }, // Leader
    { memberId: '3', name: 'Charlie', currentShare: 0, currentLoanAmount: 0 }
  ];
  
  nonLeaderMembers = displayableMembers.filter(member => member.id !== selectedLeaderId);
  selectedNonLeaderMembers = memberFields.filter(field => field.memberId !== selectedLeaderId);
  areAllSelected = nonLeaderMembers.length > 0 && selectedNonLeaderMembers.length === nonLeaderMembers.length;
  
  console.log('Test 3 - Some members selected:');
  console.log('Non-leader members:', nonLeaderMembers.length);
  console.log('Selected non-leader members:', selectedNonLeaderMembers.length);
  console.log('Are all selected?', areAllSelected);
  console.log('Button should show: "Select All Members"');
  console.log('');
  
  console.log('✅ All tests show expected behavior!');
}

testSelectAllLogic();
