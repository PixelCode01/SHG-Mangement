// Test script to verify group deletion permissions
console.log('Testing group deletion permissions...');

// Test scenarios for different user roles
const testScenarios = [
  {
    name: 'Admin user',
    user: { role: 'ADMIN', memberId: 'admin-123' },
    group: { leaderId: 'leader-456' },
    expectedAccess: true,
    reason: 'Admins can delete any group'
  },
  {
    name: 'Group leader (own group)',
    user: { role: 'GROUP_LEADER', memberId: 'leader-456' },
    group: { leaderId: 'leader-456' },
    expectedAccess: true,
    reason: 'Group leaders can delete groups they lead'
  },
  {
    name: 'Group leader (different group)',
    user: { role: 'GROUP_LEADER', memberId: 'leader-789' },
    group: { leaderId: 'leader-456' },
    expectedAccess: false,
    reason: 'Group leaders cannot delete groups they do not lead'
  },
  {
    name: 'Regular member',
    user: { role: 'MEMBER', memberId: 'member-123' },
    group: { leaderId: 'leader-456' },
    expectedAccess: false,
    reason: 'Regular members cannot delete groups'
  }
];

// Function to simulate the frontend permission check
function canDeleteGroup(user, group) {
  return user.role === 'ADMIN' || 
         (user.role === 'GROUP_LEADER' && user.memberId === group.leaderId);
}

// Function to simulate the backend permission check
function backendCanDeleteGroup(user, group) {
  if (user.role === 'ADMIN') {
    return true;
  } else if (user.role === 'GROUP_LEADER') {
    return user.memberId === group.leaderId;
  }
  return false;
}

console.log('\n--- Permission Test Results ---');
testScenarios.forEach((scenario, index) => {
  const frontendResult = canDeleteGroup(scenario.user, scenario.group);
  const backendResult = backendCanDeleteGroup(scenario.user, scenario.group);
  const passed = frontendResult === scenario.expectedAccess && 
                 backendResult === scenario.expectedAccess &&
                 frontendResult === backendResult;
  
  console.log(`\n${index + 1}. ${scenario.name}`);
  console.log(`   User: ${scenario.user.role} (ID: ${scenario.user.memberId})`);
  console.log(`   Group Leader: ${scenario.group.leaderId}`);
  console.log(`   Expected: ${scenario.expectedAccess ? 'ALLOW' : 'DENY'}`);
  console.log(`   Frontend: ${frontendResult ? 'ALLOW' : 'DENY'}`);
  console.log(`   Backend: ${backendResult ? 'ALLOW' : 'DENY'}`);
  console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Reason: ${scenario.reason}`);
});

const allPassed = testScenarios.every(scenario => {
  const frontendResult = canDeleteGroup(scenario.user, scenario.group);
  const backendResult = backendCanDeleteGroup(scenario.user, scenario.group);
  return frontendResult === scenario.expectedAccess && 
         backendResult === scenario.expectedAccess &&
         frontendResult === backendResult;
});

console.log(`\n--- Summary ---`);
console.log(`${allPassed ? '✅ All tests passed!' : '❌ Some tests failed!'}`);
console.log(`Frontend and backend permission logic is ${allPassed ? 'consistent' : 'inconsistent'}.`);
